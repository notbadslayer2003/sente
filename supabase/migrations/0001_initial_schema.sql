-- =============================================================================
-- Sente — Schema initial (v2, sécurité renforcée)
-- =============================================================================
-- Conventions :
--   - Prix en cents (integer). 1 EUR = 100 cents.
--   - Commission en basis points (integer). 5% = 500 bps.
--   - Soft delete via deleted_at. RLS filtre auto.
--   - SECURITY DEFINER toujours avec SET search_path = public, pg_catalog.
--   - REVOKE EXECUTE FROM public sur les fonctions sensibles.
--   - Toutes les contraintes CHECK explicites.
-- =============================================================================

-- 1. Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";       -- gen_random_uuid()
create extension if not exists "citext";         -- emails case-insensitive
create extension if not exists "postgis";        -- requêtes géo (rayon)
create extension if not exists "pg_trgm";        -- recherche trigram

-- 2. Custom types (enums)
-- -----------------------------------------------------------------------------
create type org_type        as enum ('etang', 'magasin');
create type org_status      as enum ('draft', 'pending_review', 'active', 'suspended', 'banned');
create type member_role     as enum ('owner', 'admin', 'staff');
create type country_code    as enum ('BE', 'FR');
create type espece_poisson  as enum ('carpe', 'silure', 'brochet', 'sandre', 'perche',
                                     'truite', 'black_bass', 'gardon', 'tanche', 'esturgeon',
                                     'salmonide', 'carnassier', 'blanc');
create type subscription_period as enum ('annuel', 'semestre', 'trimestre', 'mensuel', 'autre');
create type payment_method  as enum ('online_card', 'cash', 'virement', 'cheque', 'autre');
create type payment_status  as enum ('pending', 'partial', 'paid', 'refunded', 'cancelled', 'failed');
create type magasin_plan    as enum ('starter', 'pro', 'boutique_plus');
create type post_status     as enum ('published', 'hidden', 'removed', 'pending_review');
create type event_type      as enum ('concours', 'journee_decouverte', 'stage', 'assemblee', 'autre');
create type event_status    as enum ('draft', 'published', 'cancelled', 'completed');
create type order_status    as enum ('pending_payment', 'paid', 'preparing', 'shipped',
                                     'delivered', 'cancelled', 'refunded', 'disputed');
create type product_status  as enum ('draft', 'active', 'out_of_stock', 'archived');
create type report_target   as enum ('post', 'comment', 'profile', 'organization');
create type report_status   as enum ('pending', 'reviewing', 'resolved', 'dismissed');

-- 3. Helper functions de base
-- -----------------------------------------------------------------------------

-- updated_at automatique
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.tg_set_updated_at() from public;

-- Validation de slug (format strict)
create or replace function public.is_valid_slug(s text)
returns boolean
language sql
immutable
security invoker
set search_path = public, pg_catalog
as $$
  select s ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(s) between 2 and 100;
$$;

-- 4. Tables — Identité & rôles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           citext not null,
  full_name       text check (full_name is null or length(full_name) between 2 and 100),
  avatar_url      text check (avatar_url is null or length(avatar_url) <= 500),
  bio             text check (bio is null or length(bio) <= 500),
  city            text check (city is null or length(city) <= 100),
  country         country_code,
  -- Préférences pêche
  especes_pref    espece_poisson[] not null default '{}',
  -- Marketing
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  -- Sécurité (rate limit auth, lockout)
  last_login_at        timestamptz,
  failed_login_count   integer not null default 0 check (failed_login_count >= 0),
  locked_until         timestamptz,
  -- 2FA
  has_2fa_enabled      boolean not null default false,
  -- Soft delete
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Bornes
  constraint profiles_especes_pref_max check (cardinality(especes_pref) <= 20)
);
comment on table public.profiles is 'Profil public, étend auth.users via le trigger handle_new_user.';

create table public.app_admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  notes      text
);
comment on table public.app_admins is 'Admins Sente. Accès via is_app_admin().';

-- 5. Tables — Organizations (étangs + magasins unifiés)
-- -----------------------------------------------------------------------------
create table public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  org_type            org_type not null,
  slug                citext unique not null check (public.is_valid_slug(slug)),
  name                text not null check (length(name) between 2 and 200),
  baseline            text check (baseline is null or length(baseline) <= 120),
  description         text check (description is null or length(description) <= 5000),
  -- Localisation
  country             country_code not null,
  region              text check (region is null or length(region) <= 100),
  city                text check (city is null or length(city) <= 100),
  postal_code         text check (postal_code is null or length(postal_code) <= 20),
  address             text check (address is null or length(address) <= 500),
  lat                 double precision check (lat is null or (lat between -90 and 90)),
  lng                 double precision check (lng is null or (lng between -180 and 180)),
  geog                geography(point, 4326)
                      generated always as (
                        case when lat is not null and lng is not null
                             then st_setsrid(st_makepoint(lng, lat), 4326)::geography
                             else null end
                      ) stored,
  -- Contact
  contact_email       citext check (contact_email is null or contact_email ~ '^[^@]+@[^@]+\.[^@]+$'),
  contact_phone       text check (contact_phone is null or length(contact_phone) <= 30),
  website             text check (website is null or website ~ '^https?://'),
  social_facebook     text check (social_facebook is null or length(social_facebook) <= 200),
  social_instagram    text check (social_instagram is null or length(social_instagram) <= 200),
  -- Médias
  cover_image_url     text check (cover_image_url is null or length(cover_image_url) <= 500),
  photos              text[] not null default '{}' check (cardinality(photos) <= 30),
  -- Statut & ownership
  status              org_status not null default 'draft',
  owner_user_id       uuid not null references public.profiles(id),
  -- Stripe Connect Express
  stripe_account_id   text unique check (stripe_account_id is null or stripe_account_id ~ '^acct_'),
  stripe_onboarded    boolean not null default false,
  stripe_charges_enabled boolean not null default false,
  stripe_payouts_enabled boolean not null default false,
  -- Soft delete
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on column public.organizations.geog is 'Calculé auto. Utiliser ST_DWithin pour requête rayon.';

create table public.memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            member_role not null default 'staff',
  invited_by      uuid references public.profiles(id),
  accepted_at     timestamptz,             -- null = invitation pending
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);
comment on table public.memberships is 'Multi-user étang/magasin. Source de vérité pour l''accès aux orgs.';

create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           citext not null check (email ~ '^[^@]+@[^@]+\.[^@]+$'),
  role            member_role not null default 'staff',
  token_hash      text unique not null,    -- SHA256 du token, pas le token en clair
  invited_by      uuid not null references public.profiles(id),
  expires_at      timestamptz not null default (now() + interval '14 days'),
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  attempts        integer not null default 0 check (attempts <= 10),
  created_at      timestamptz not null default now(),
  check (expires_at > created_at)
);
comment on column public.invitations.token_hash is
  'SHA256 hex du token. Le token clair est envoyé par email, jamais stocké.';

-- 6. Tables — Détails étangs
-- -----------------------------------------------------------------------------
create table public.etang_details (
  organization_id      uuid primary key references public.organizations(id) on delete cascade,
  superficie_ha        numeric(8,2) check (superficie_ha is null or superficie_ha > 0),
  profondeur_max_m     numeric(5,1) check (profondeur_max_m is null or profondeur_max_m > 0),
  especes              espece_poisson[] not null default '{}'
                       check (cardinality(especes) <= 15),
  -- Règlement (jsonb structuré)
  reglement            jsonb not null default '{}'::jsonb,
  -- Tarifs publics indicatifs (cents EUR)
  tarif_journee_cents  integer check (tarif_journee_cents is null or tarif_journee_cents between 0 and 100000),
  tarif_annee_cents    integer check (tarif_annee_cents is null or tarif_annee_cents between 0 and 1000000),
  -- Stats
  record_kg            numeric(6,2) check (record_kg is null or record_kg > 0),
  postes_count         integer not null default 0 check (postes_count >= 0),
  -- Configuration
  postes_attribues_actifs boolean not null default false,
  reservation_active   boolean not null default false,
  updated_at           timestamptz not null default now()
);

create table public.postes (
  id              uuid primary key default gen_random_uuid(),
  etang_id        uuid not null references public.organizations(id) on delete cascade,
  numero          text not null check (length(numero) between 1 and 20),
  label           text check (label is null or length(label) <= 100),
  description     text check (description is null or length(description) <= 500),
  lat             double precision check (lat is null or (lat between -90 and 90)),
  lng             double precision check (lng is null or (lng between -180 and 180)),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (etang_id, numero)
);

-- 7. Tables — Détails magasins
-- -----------------------------------------------------------------------------
create table public.magasin_details (
  organization_id  uuid primary key references public.organizations(id) on delete cascade,
  specialites      text[] not null default '{}' check (cardinality(specialites) <= 10),
  marques          text[] not null default '{}' check (cardinality(marques) <= 50),
  horaires         jsonb not null default '{}'::jsonb,
  -- Plan e-commerce
  plan             magasin_plan not null default 'starter',
  -- Snapshot de commission (recopié sur chaque order)
  commission_rate_bps integer not null default 500
                      check (commission_rate_bps between 0 and 10000),
  partner_since    timestamptz,
  updated_at       timestamptz not null default now()
);

-- 8. Tables — CRM Étang : abonnements pêcheurs
-- -----------------------------------------------------------------------------
create table public.pecheur_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  etang_id            uuid not null references public.organizations(id) on delete cascade,
  -- Pêcheur : user inscrit OU contact saisi manuellement
  pecheur_user_id     uuid references public.profiles(id),
  pecheur_full_name   text not null check (length(pecheur_full_name) between 2 and 100),
  pecheur_email       citext check (pecheur_email is null or pecheur_email ~ '^[^@]+@[^@]+\.[^@]+$'),
  pecheur_phone       text check (pecheur_phone is null or length(pecheur_phone) <= 30),
  -- Période
  saison_year         integer not null check (saison_year between 2024 and 2100),
  period_type         subscription_period not null default 'annuel',
  start_date          date not null,
  end_date            date not null,
  -- Place
  poste_id            uuid references public.postes(id),
  -- Tarification
  price_cents         integer not null check (price_cents between 0 and 1000000),
  paid_amount_cents   integer not null default 0 check (paid_amount_cents >= 0),
  payment_method      payment_method not null default 'cash',
  payment_status      payment_status not null default 'pending',
  paid_at             timestamptz,
  -- Stripe
  stripe_payment_intent_id text unique check (stripe_payment_intent_id is null or stripe_payment_intent_id ~ '^pi_'),
  -- Commission (snapshot au moment du paiement online)
  sente_commission_cents   integer not null default 0 check (sente_commission_cents >= 0),
  sente_commission_rate_bps integer check (sente_commission_rate_bps is null or sente_commission_rate_bps between 0 and 10000),
  -- Métadonnées
  notes               text check (notes is null or length(notes) <= 2000),
  created_by_user_id  uuid not null references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Cohérence
  check (end_date >= start_date),
  check (paid_amount_cents <= price_cents)
);
comment on table public.pecheur_subscriptions is
  'Registre annuel/longue durée. Renouvellement validé manuellement chaque saison.';

-- 9. Tables — Fil social
-- -----------------------------------------------------------------------------
create table public.posts (
  id                  uuid primary key default gen_random_uuid(),
  -- Author : org OU user (CHECK XOR)
  author_org_id       uuid references public.organizations(id) on delete cascade,
  author_user_id      uuid references public.profiles(id) on delete cascade,
  content             text not null check (length(content) between 1 and 4000),
  photos              text[] not null default '{}' check (cardinality(photos) <= 10),
  -- Modération
  status              post_status not null default 'published',
  -- Compteurs dénormalisés
  likes_count         integer not null default 0 check (likes_count >= 0),
  comments_count      integer not null default 0 check (comments_count >= 0),
  reports_count       integer not null default 0 check (reports_count >= 0),
  -- Soft delete
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (
    (author_org_id is not null and author_user_id is null) or
    (author_org_id is null and author_user_id is not null)
  )
);

create table public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.post_comments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts(id) on delete cascade,
  parent_id     uuid references public.post_comments(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  content       text not null check (length(content) between 1 and 2000),
  status        post_status not null default 'published',
  likes_count   integer not null default 0 check (likes_count >= 0),
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table public.follows (
  follower_user_id uuid not null references public.profiles(id) on delete cascade,
  target_org_id    uuid not null references public.organizations(id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (follower_user_id, target_org_id)
);

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  target_type     report_target not null,
  target_id       uuid not null,
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  reason          text not null check (length(reason) between 3 and 200),
  detail          text check (detail is null or length(detail) <= 2000),
  status          report_status not null default 'pending',
  resolved_by     uuid references public.profiles(id),
  resolved_at     timestamptz,
  resolution_note text check (resolution_note is null or length(resolution_note) <= 2000),
  created_at      timestamptz not null default now()
);

-- 10. Tables — Événements
-- -----------------------------------------------------------------------------
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title           text not null check (length(title) between 3 and 200),
  description     text check (description is null or length(description) <= 5000),
  event_type      event_type not null default 'autre',
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  location_text   text check (location_text is null or length(location_text) <= 500),
  max_participants integer check (max_participants is null or max_participants > 0),
  price_cents     integer not null default 0 check (price_cents between 0 and 1000000),
  cover_image_url text check (cover_image_url is null or length(cover_image_url) <= 500),
  photos          text[] not null default '{}' check (cardinality(photos) <= 10),
  status          event_status not null default 'draft',
  registrations_count integer not null default 0 check (registrations_count >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create table public.event_registrations (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  user_id         uuid references public.profiles(id),
  full_name       text not null check (length(full_name) between 2 and 100),
  email           citext not null check (email ~ '^[^@]+@[^@]+\.[^@]+$'),
  phone           text check (phone is null or length(phone) <= 30),
  payment_status  payment_status not null default 'pending',
  paid_amount_cents integer not null default 0 check (paid_amount_cents >= 0),
  stripe_payment_intent_id text unique check (stripe_payment_intent_id is null or stripe_payment_intent_id ~ '^pi_'),
  created_at      timestamptz not null default now()
);

-- 11. Tables — E-commerce magasins (V1.5)
-- -----------------------------------------------------------------------------
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  magasin_id      uuid not null references public.organizations(id) on delete cascade,
  slug            citext not null check (public.is_valid_slug(slug)),
  name            text not null check (length(name) between 2 and 200),
  description     text check (description is null or length(description) <= 10000),
  brand           text check (brand is null or length(brand) <= 100),
  category        text check (category is null or length(category) <= 100),
  sku             text check (sku is null or length(sku) <= 50),
  price_cents     integer not null check (price_cents between 1 and 10000000),
  stock_qty       integer not null default 0 check (stock_qty >= 0),
  weight_grams    integer check (weight_grams is null or (weight_grams between 0 and 100000)),
  photos          text[] not null default '{}' check (cardinality(photos) <= 15),
  status          product_status not null default 'draft',
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (magasin_id, slug)
);

create table public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  name        text not null check (length(name) between 1 and 100),
  sku         text check (sku is null or length(sku) <= 50),
  price_cents integer check (price_cents is null or (price_cents between 1 and 10000000)),
  stock_qty   integer not null default 0 check (stock_qty >= 0),
  created_at  timestamptz not null default now()
);

create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  magasin_id          uuid not null references public.organizations(id),
  buyer_user_id       uuid not null references public.profiles(id),
  status              order_status not null default 'pending_payment',
  -- Montants snapshot
  subtotal_cents      integer not null default 0 check (subtotal_cents >= 0),
  shipping_cents      integer not null default 0 check (shipping_cents >= 0),
  total_cents         integer not null default 0 check (total_cents >= 0),
  -- Commission Sente (snapshot)
  commission_rate_bps integer not null check (commission_rate_bps between 0 and 10000),
  sente_commission_cents integer not null default 0 check (sente_commission_cents >= 0),
  -- Stripe
  stripe_payment_intent_id text unique check (stripe_payment_intent_id is null or stripe_payment_intent_id ~ '^pi_'),
  stripe_charge_id    text check (stripe_charge_id is null or stripe_charge_id ~ '^ch_'),
  -- Livraison
  shipping_address    jsonb,
  tracking_carrier    text check (tracking_carrier is null or length(tracking_carrier) <= 50),
  tracking_number     text check (tracking_number is null or length(tracking_number) <= 100),
  shipped_at          timestamptz,
  delivered_at        timestamptz,
  cancelled_at        timestamptz,
  refunded_at         timestamptz,
  refund_reason       text check (refund_reason is null or length(refund_reason) <= 1000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  product_id        uuid not null references public.products(id),
  variant_id        uuid references public.product_variants(id),
  -- Snapshots
  product_name      text not null check (length(product_name) between 1 and 200),
  variant_name      text check (variant_name is null or length(variant_name) <= 100),
  unit_price_cents  integer not null check (unit_price_cents > 0),
  quantity          integer not null check (quantity between 1 and 1000),
  line_total_cents  integer not null check (line_total_cents > 0),
  created_at        timestamptz not null default now()
);

-- 12. Tables — Paiements unifiés + idempotence webhooks
-- -----------------------------------------------------------------------------
create table public.payments (
  id                       uuid primary key default gen_random_uuid(),
  kind                     text not null check (kind in ('etang_subscription','order','event_registration','platform_fee')),
  reference_id             uuid not null,
  payer_user_id            uuid references public.profiles(id),
  recipient_org_id         uuid references public.organizations(id),
  amount_cents             integer not null check (amount_cents >= 0),
  sente_commission_cents   integer not null default 0 check (sente_commission_cents >= 0),
  currency                 text not null default 'eur' check (length(currency) = 3),
  stripe_payment_intent_id text unique check (stripe_payment_intent_id is null or stripe_payment_intent_id ~ '^pi_'),
  stripe_charge_id         text check (stripe_charge_id is null or stripe_charge_id ~ '^ch_'),
  stripe_transfer_id       text check (stripe_transfer_id is null or stripe_transfer_id ~ '^tr_'),
  status                   payment_status not null default 'pending',
  raw_event                jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ⚡ Idempotence Stripe webhooks (anti-replay)
create table public.webhook_events (
  stripe_event_id text primary key check (stripe_event_id ~ '^evt_'),
  event_type      text not null,
  received_at     timestamptz not null default now(),
  processed_at    timestamptz,
  payload         jsonb,
  error_message   text
);
comment on table public.webhook_events is
  'Stripe event_id PRIMARY KEY = idempotence garantie. Insert avant traitement, conflict = déjà traité.';

-- 13. Tables — Conformité & infra
-- -----------------------------------------------------------------------------
create table public.consent_log (
  id          bigserial primary key,
  user_id     uuid references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('tos','privacy','marketing','cookies_analytics','cookies_payment')),
  version     text not null check (length(version) <= 20),
  granted     boolean not null,
  ip          inet,
  user_agent  text check (user_agent is null or length(user_agent) <= 500),
  created_at  timestamptz not null default now()
);

-- audit_log : APPEND-ONLY. Aucun UPDATE ni DELETE n'est autorisé sauf service_role.
create table public.audit_log (
  id            bigserial primary key,
  actor_user_id uuid references public.profiles(id),
  action        text not null check (length(action) between 3 and 100),
  target_type   text check (target_type is null or length(target_type) <= 50),
  target_id     uuid,
  payload       jsonb,
  ip            inet,
  user_agent    text check (user_agent is null or length(user_agent) <= 500),
  created_at    timestamptz not null default now()
);
comment on table public.audit_log is 'Append-only. Trigger bloque UPDATE/DELETE.';

create table public.feature_flags (
  key         text primary key check (length(key) between 2 and 100),
  enabled     boolean not null default false,
  description text,
  rollout_pct integer not null default 0 check (rollout_pct between 0 and 100),
  updated_at  timestamptz not null default now()
);

-- 14. Triggers — updated_at automatique
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'profiles','organizations','memberships','etang_details','magasin_details',
      'pecheur_subscriptions','posts','post_comments','events','products',
      'product_variants','orders','payments','feature_flags'
    ])
  loop
    execute format(
      'create trigger tg_%s_updated_at before update on public.%s
         for each row execute function public.tg_set_updated_at();',
      t, t
    );
  end loop;
end $$;

-- 15. Trigger — création auto du profile au signup
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 16. Triggers — compteurs dénormalisés
-- -----------------------------------------------------------------------------
create or replace function public.tg_post_likes_count()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger tg_post_likes_count
  after insert or delete on public.post_likes
  for each row execute function public.tg_post_likes_count();

create or replace function public.tg_post_comments_count()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger tg_post_comments_count
  after insert or delete on public.post_comments
  for each row execute function public.tg_post_comments_count();

create or replace function public.tg_comment_likes_count()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if (tg_op = 'INSERT') then
    update public.post_comments set likes_count = likes_count + 1 where id = new.comment_id;
  elsif (tg_op = 'DELETE') then
    update public.post_comments set likes_count = greatest(likes_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end;
$$;
create trigger tg_comment_likes_count
  after insert or delete on public.comment_likes
  for each row execute function public.tg_comment_likes_count();

create or replace function public.tg_event_registrations_count()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if (tg_op = 'INSERT') then
    update public.events set registrations_count = registrations_count + 1 where id = new.event_id;
  elsif (tg_op = 'DELETE') then
    update public.events set registrations_count = greatest(registrations_count - 1, 0) where id = old.event_id;
  end if;
  return null;
end;
$$;
create trigger tg_event_registrations_count
  after insert or delete on public.event_registrations
  for each row execute function public.tg_event_registrations_count();

-- Maintien du reports_count sur posts
create or replace function public.tg_post_reports_count()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if (tg_op = 'INSERT' and new.target_type = 'post') then
    update public.posts set reports_count = reports_count + 1 where id = new.target_id;
  end if;
  return null;
end;
$$;
create trigger tg_post_reports_count
  after insert on public.reports
  for each row execute function public.tg_post_reports_count();

-- 17. Trigger — audit_log immutable
-- -----------------------------------------------------------------------------
create or replace function public.tg_block_audit_modifications()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  raise exception 'audit_log is append-only. UPDATE/DELETE forbidden.';
end;
$$;

create trigger tg_audit_log_no_update
  before update on public.audit_log
  for each row execute function public.tg_block_audit_modifications();

create trigger tg_audit_log_no_delete
  before delete on public.audit_log
  for each row execute function public.tg_block_audit_modifications();

-- 18. Helpers d'autorisation (RLS)
-- -----------------------------------------------------------------------------
-- is_app_admin : SECURITY DEFINER pour ne pas dépendre du RLS de app_admins
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.app_admins where user_id = auth.uid()
  );
$$;
revoke execute on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

-- is_org_member : SECURITY DEFINER (sinon RLS récursif sur memberships)
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = org
      and user_id = auth.uid()
      and accepted_at is not null
  );
$$;
revoke execute on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;

-- is_org_owner_or_admin
create or replace function public.is_org_owner_or_admin(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = org
      and user_id = auth.uid()
      and accepted_at is not null
      and role in ('owner','admin')
  );
$$;
revoke execute on function public.is_org_owner_or_admin(uuid) from public;
grant execute on function public.is_org_owner_or_admin(uuid) to authenticated;

-- 19. Indexes critiques
-- -----------------------------------------------------------------------------
-- Profiles
create index idx_profiles_country on public.profiles(country) where deleted_at is null;
create index idx_profiles_locked_until on public.profiles(locked_until) where locked_until is not null;

-- Organizations : filtres & géo
create index idx_orgs_active on public.organizations(org_type, country, region)
  where status = 'active' and deleted_at is null;
create index idx_orgs_owner on public.organizations(owner_user_id);
create index idx_orgs_geog on public.organizations using gist(geog) where deleted_at is null;
create index idx_orgs_name_trgm on public.organizations using gin(name gin_trgm_ops);
create index idx_orgs_status_pending on public.organizations(created_at desc) where status = 'pending_review';

-- Memberships
create index idx_memberships_user on public.memberships(user_id) where accepted_at is not null;
create index idx_memberships_org on public.memberships(organization_id) where accepted_at is not null;

-- Invitations
create index idx_invitations_email_active on public.invitations(email)
  where accepted_at is null and revoked_at is null;
create index idx_invitations_token_hash on public.invitations(token_hash);

-- Postes
create index idx_postes_etang_active on public.postes(etang_id) where active is true;

-- Pecheur subscriptions (dashboard étang)
create index idx_pecheur_subs_etang_year on public.pecheur_subscriptions(etang_id, saison_year desc);
create index idx_pecheur_subs_user on public.pecheur_subscriptions(pecheur_user_id) where pecheur_user_id is not null;
create index idx_pecheur_subs_status on public.pecheur_subscriptions(etang_id, payment_status);

-- Posts (feed)
create index idx_posts_published_recent on public.posts(created_at desc)
  where status = 'published' and deleted_at is null;
create index idx_posts_author_org on public.posts(author_org_id, created_at desc)
  where status = 'published' and deleted_at is null;
create index idx_posts_author_user on public.posts(author_user_id, created_at desc)
  where status = 'published' and deleted_at is null;
create index idx_posts_high_reports on public.posts(reports_count desc)
  where status = 'published' and reports_count > 0;

create index idx_post_comments_post on public.post_comments(post_id, created_at)
  where status = 'published' and deleted_at is null;

-- Follows
create index idx_follows_follower on public.follows(follower_user_id);
create index idx_follows_target on public.follows(target_org_id);

-- Events
create index idx_events_org_starts on public.events(organization_id, starts_at desc);
create index idx_events_published on public.events(starts_at)
    where status = 'published';

-- E-commerce
create index idx_products_magasin_active on public.products(magasin_id)
  where status = 'active' and deleted_at is null;
create index idx_products_name_trgm on public.products using gin(name gin_trgm_ops);
create index idx_orders_magasin_recent on public.orders(magasin_id, created_at desc);
create index idx_orders_buyer on public.orders(buyer_user_id, created_at desc);
create index idx_orders_status_pending on public.orders(created_at desc) where status = 'pending_payment';
create index idx_order_items_order on public.order_items(order_id);

-- Payments
create index idx_payments_kind_ref on public.payments(kind, reference_id);
create index idx_payments_recipient on public.payments(recipient_org_id, created_at desc);
create index idx_payments_payer on public.payments(payer_user_id, created_at desc);

-- Webhook events (perf de l'idempotence)
create index idx_webhook_events_received on public.webhook_events(received_at desc) where processed_at is null;

-- Reports (modération)
create index idx_reports_pending on public.reports(created_at desc) where status = 'pending';
create index idx_reports_target on public.reports(target_type, target_id);

-- Audit log
create index idx_audit_actor on public.audit_log(actor_user_id, created_at desc);
create index idx_audit_target on public.audit_log(target_type, target_id, created_at desc);
create index idx_audit_action on public.audit_log(action, created_at desc);

-- Consent log
create index idx_consent_user_kind on public.consent_log(user_id, kind, created_at desc);
