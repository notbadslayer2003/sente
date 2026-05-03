-- =============================================================================
-- Sente — Phase 6.5 : événements (CRUD + inscriptions + paiements)
-- Session A : enrichissement schema + RPCs CRUD événements
-- =============================================================================

-- 1. Enrichissement events
alter table public.events
    add column if not exists deleted_at timestamptz,
    add column if not exists commission_rate_bps integer
    check (commission_rate_bps is null or (commission_rate_bps >= 0 and commission_rate_bps <= 5000)),
    -- Métadonnées spécifiques pêche
    add column if not exists espece_cible espece_poisson,
    add column if not exists niveau text
    check (niveau is null or niveau in ('debutant','intermediaire','expert','tous_niveaux')),
    add column if not exists materiel_fourni text
    check (materiel_fourni is null or length(materiel_fourni) <= 1000),
    add column if not exists materiel_a_apporter text
    check (materiel_a_apporter is null or length(materiel_a_apporter) <= 1000),
    -- Lieu structuré
    add column if not exists location_lat double precision,
    add column if not exists location_lng double precision,
    -- Champ pour annulation : raison fournie par l'org
    add column if not exists cancellation_reason text
    check (cancellation_reason is null or length(cancellation_reason) <= 1000),
    add column if not exists cancelled_at timestamptz;

comment on column public.events.commission_rate_bps is
  'Taux de commission Sente en basis points pour cet événement. NULL = utilise le taux par défaut de l''org.';
comment on column public.events.espece_cible is 'Espèce ciblée (concours pêche, journée découverte d''une espèce).';
comment on column public.events.niveau is 'Niveau requis pour participer.';
comment on column public.events.cancelled_at is 'Timestamp d''annulation. Si non null, status = cancelled.';

-- Constraint : ends_at >= starts_at quand fourni
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'events' and constraint_name = 'events_ends_after_starts'
  ) then
alter table public.events
    add constraint events_ends_after_starts
        check (ends_at is null or ends_at >= starts_at);
end if;
end$$;

-- Index pour la recherche temporelle publique
create index if not exists idx_events_published_upcoming
    on public.events(starts_at)
    where status = 'published' and deleted_at is null;

create index if not exists idx_events_org_published
    on public.events(organization_id, starts_at desc)
    where status = 'published' and deleted_at is null;

-- 2. Enrichissement event_registrations
alter table public.event_registrations
    add column if not exists payment_method text not null default 'online_card'
    check (payment_method in ('online_card','on_site_cash','free')),
    add column if not exists sente_commission_cents integer not null default 0
    check (sente_commission_cents >= 0),
    add column if not exists sente_commission_rate_bps integer
    check (sente_commission_rate_bps is null or sente_commission_rate_bps >= 0),
    add column if not exists notes text
    check (notes is null or length(notes) <= 1000),
    add column if not exists refunded_amount_cents integer not null default 0
    check (refunded_amount_cents >= 0),
    add column if not exists refund_reason text
    check (refund_reason is null or length(refund_reason) between 10 and 1000),
    add column if not exists refunded_at timestamptz,
    add column if not exists stripe_charge_id text,
    -- Plan ne pas dupliquer : payment_token sera dans payments via reference_id
    add column if not exists paid_at timestamptz;

comment on column public.event_registrations.payment_method is
  'online_card = Stripe, on_site_cash = espèces sur place, free = event gratuit (paid_amount=0)';
comment on column public.event_registrations.sente_commission_cents is
  'Snapshot de la commission Sente prélevée au moment du paiement.';

-- Index pour la liste inscrits par event
create index if not exists idx_registrations_event_created
    on public.event_registrations(event_id, created_at);

-- 3. Étendre payments.kind pour autoriser 'event_registration' (déjà présent ?)
-- Le check actuel est : 'etang_subscription','order','event_registration','platform_fee','refund'
-- → déjà bon, rien à faire.

-- 4. Mettre à jour le compteur registrations_count via trigger
create or replace function public.tg_event_registrations_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if (tg_op = 'INSERT') then
update public.events
set registrations_count = registrations_count + 1
where id = new.event_id;
return new;
elsif (tg_op = 'DELETE') then
update public.events
set registrations_count = greatest(registrations_count - 1, 0)
where id = old.event_id;
return old;
end if;
return null;
end;
$$;

drop trigger if exists trg_event_registrations_count on public.event_registrations;
create trigger trg_event_registrations_count
    after insert or delete on public.event_registrations
  for each row execute function public.tg_event_registrations_count();

-- Backfill des compteurs (au cas où)
update public.events e
set registrations_count = (
    select count(*) from public.event_registrations r
    where r.event_id = e.id
);

-- =============================================================================
-- RLS events
-- =============================================================================
alter table public.events enable row level security;

drop policy if exists "events read public" on public.events;
create policy "events read public" on public.events
  for select to anon, authenticated
                      using (
                      deleted_at is null and (
                      status = 'published'
                      or status = 'cancelled'  -- on garde visible les events annulés pour transparence
                      or status = 'completed'
                      or public.is_org_member(organization_id)
                      or public.is_app_admin()
                      )
                      );

drop policy if exists "events insert org member" on public.events;
create policy "events insert org member" on public.events
  for insert to authenticated
  with check (
    public.is_org_owner_or_admin(organization_id)
    -- L'org doit être active
    and exists (
      select 1 from public.organizations
      where id = organization_id and status = 'active' and deleted_at is null
    )
  );

drop policy if exists "events update org member" on public.events;
create policy "events update org member" on public.events
  for update to authenticated
                                  using (public.is_org_owner_or_admin(organization_id))
      with check (public.is_org_owner_or_admin(organization_id));

drop policy if exists "events admin all" on public.events;
create policy "events admin all" on public.events
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- =============================================================================
-- RLS event_registrations
-- =============================================================================
alter table public.event_registrations enable row level security;
alter table public.event_registrations force row level security;

drop policy if exists "registrations read own" on public.event_registrations;
create policy "registrations read own" on public.event_registrations
  for select to authenticated
                      using (user_id = auth.uid());

drop policy if exists "registrations read org" on public.event_registrations;
create policy "registrations read org" on public.event_registrations
  for select to authenticated
                      using (
                      exists (
                      select 1 from public.events e
                      where e.id = event_id
                      and public.is_org_owner_or_admin(e.organization_id)
                      )
                      );

-- Pas d'INSERT direct par les users (passe par RPC)
drop policy if exists "registrations insert blocked" on public.event_registrations;
create policy "registrations insert blocked" on public.event_registrations
  for insert to authenticated
  with check (false);

-- Pas d'UPDATE direct
drop policy if exists "registrations update blocked" on public.event_registrations;
create policy "registrations update blocked" on public.event_registrations
  for update to authenticated
                                  using (false)
      with check (false);

drop policy if exists "registrations admin all" on public.event_registrations;
create policy "registrations admin all" on public.event_registrations
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- =============================================================================
-- RPCs events CRUD
-- =============================================================================

-- 5. RPC : create_event
create or replace function public.create_event(
  p_organization_id   uuid,
  p_title             text,
  p_description       text,
  p_event_type        event_type,
  p_starts_at         timestamptz,
  p_ends_at           timestamptz,
  p_location_text     text,
  p_location_lat      double precision,
  p_location_lng      double precision,
  p_max_participants  integer,
  p_price_cents       integer,
  p_commission_rate_bps integer,
  p_espece_cible      espece_poisson,
  p_niveau            text,
  p_materiel_fourni   text,
  p_materiel_a_apporter text,
  p_cover_image_url   text,
  p_publish_now       boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_event_id uuid;
  v_org_active boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  if not public.is_org_owner_or_admin(p_organization_id) then
    raise exception 'Tu n''es pas owner ou admin de cette organisation' using errcode = '42501';
end if;

  -- Org active ?
select (status = 'active' and deleted_at is null) into v_org_active
from public.organizations where id = p_organization_id;
if not v_org_active then
    raise exception 'L''organisation n''est pas active' using errcode = '42501';
end if;

  -- Validations basiques
  if p_title is null or length(trim(p_title)) < 3 or length(p_title) > 200 then
    raise exception 'Titre invalide (3-200 caractères)' using errcode = '23514';
end if;

  if p_starts_at < now() then
    raise exception 'La date de début doit être dans le futur' using errcode = '23514';
end if;

  if p_ends_at is not null and p_ends_at < p_starts_at then
    raise exception 'La date de fin doit être après la date de début' using errcode = '23514';
end if;

  if p_price_cents < 0 then
    raise exception 'Prix invalide' using errcode = '23514';
end if;

  if p_max_participants is not null and p_max_participants <= 0 then
    raise exception 'Capacité invalide' using errcode = '23514';
end if;

  if p_commission_rate_bps is not null and (p_commission_rate_bps < 0 or p_commission_rate_bps > 5000) then
    raise exception 'Taux de commission invalide (0-5000 bps)' using errcode = '23514';
end if;

insert into public.events (
    organization_id, title, description, event_type,
    starts_at, ends_at,
    location_text, location_lat, location_lng,
    max_participants, price_cents, commission_rate_bps,
    espece_cible, niveau, materiel_fourni, materiel_a_apporter,
    cover_image_url, status
)
values (
           p_organization_id, trim(p_title), nullif(trim(coalesce(p_description, '')), ''),
           coalesce(p_event_type, 'autre'::event_type),
           p_starts_at, p_ends_at,
           nullif(trim(coalesce(p_location_text, '')), ''), p_location_lat, p_location_lng,
           p_max_participants, p_price_cents, p_commission_rate_bps,
           p_espece_cible,
           nullif(trim(coalesce(p_niveau, '')), ''),
           nullif(trim(coalesce(p_materiel_fourni, '')), ''),
           nullif(trim(coalesce(p_materiel_a_apporter, '')), ''),
           nullif(trim(coalesce(p_cover_image_url, '')), ''),
           case when p_publish_now then 'published'::event_status else 'draft'::event_status end
       )
    returning id into v_event_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           case when p_publish_now then 'event.publish' else 'event.create_draft' end,
           'event',
           v_event_id,
           jsonb_build_object('organization_id', p_organization_id, 'title', p_title, 'starts_at', p_starts_at)
       );

return v_event_id;
end;
$$;
revoke execute on function public.create_event(uuid, text, text, event_type, timestamptz, timestamptz, text, double precision, double precision, integer, integer, integer, espece_poisson, text, text, text, text, boolean) from public;
grant execute on function public.create_event(uuid, text, text, event_type, timestamptz, timestamptz, text, double precision, double precision, integer, integer, integer, espece_poisson, text, text, text, text, boolean) to authenticated;

-- 6. RPC : update_event
create or replace function public.update_event(
  p_event_id          uuid,
  p_title             text,
  p_description       text,
  p_event_type        event_type,
  p_starts_at         timestamptz,
  p_ends_at           timestamptz,
  p_location_text     text,
  p_location_lat      double precision,
  p_location_lng      double precision,
  p_max_participants  integer,
  p_price_cents       integer,
  p_commission_rate_bps integer,
  p_espece_cible      espece_poisson,
  p_niveau            text,
  p_materiel_fourni   text,
  p_materiel_a_apporter text,
  p_cover_image_url   text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_org_id uuid;
  v_status event_status;
  v_has_paid_registrations boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

select organization_id, status into v_org_id, v_status
from public.events where id = p_event_id and deleted_at is null;
if v_org_id is null then
    raise exception 'Événement introuvable' using errcode = '42P01';
end if;

  if not public.is_org_owner_or_admin(v_org_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

  if v_status = 'cancelled' then
    raise exception 'Événement annulé non modifiable' using errcode = '42501';
end if;

  -- Validations
  if p_title is null or length(trim(p_title)) < 3 or length(p_title) > 200 then
    raise exception 'Titre invalide (3-200 caractères)' using errcode = '23514';
end if;

  if p_ends_at is not null and p_ends_at < p_starts_at then
    raise exception 'La date de fin doit être après la date de début' using errcode = '23514';
end if;

  if p_price_cents < 0 then
    raise exception 'Prix invalide' using errcode = '23514';
end if;

  if p_max_participants is not null and p_max_participants <= 0 then
    raise exception 'Capacité invalide' using errcode = '23514';
end if;

  -- Si paiements déjà reçus, on ne peut pas changer le prix librement
select exists(
    select 1 from public.event_registrations
    where event_id = p_event_id and paid_amount_cents > 0
) into v_has_paid_registrations;

if v_has_paid_registrations then
    -- On compare avec la valeur actuelle
    declare v_current_price integer;
begin
select price_cents into v_current_price from public.events where id = p_event_id;
if v_current_price <> p_price_cents then
        raise exception 'Le prix ne peut plus être modifié, des inscriptions ont été payées' using errcode = '42501';
end if;
end;
end if;

update public.events
set title = trim(p_title),
    description = nullif(trim(coalesce(p_description, '')), ''),
    event_type = coalesce(p_event_type, event_type),
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    location_text = nullif(trim(coalesce(p_location_text, '')), ''),
    location_lat = p_location_lat,
    location_lng = p_location_lng,
    max_participants = p_max_participants,
    price_cents = p_price_cents,
    commission_rate_bps = p_commission_rate_bps,
    espece_cible = p_espece_cible,
    niveau = nullif(trim(coalesce(p_niveau, '')), ''),
    materiel_fourni = nullif(trim(coalesce(p_materiel_fourni, '')), ''),
    materiel_a_apporter = nullif(trim(coalesce(p_materiel_a_apporter, '')), ''),
    cover_image_url = nullif(trim(coalesce(p_cover_image_url, '')), ''),
    updated_at = now()
where id = p_event_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (v_user_id, 'event.update', 'event', p_event_id, '{}'::jsonb);
end;
$$;
revoke execute on function public.update_event(uuid, text, text, event_type, timestamptz, timestamptz, text, double precision, double precision, integer, integer, integer, espece_poisson, text, text, text, text) from public;
grant execute on function public.update_event(uuid, text, text, event_type, timestamptz, timestamptz, text, double precision, double precision, integer, integer, integer, espece_poisson, text, text, text, text) to authenticated;

-- 7. RPC : publish_event (passe draft -> published)
create or replace function public.publish_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_org_id uuid;
  v_status event_status;
  v_starts_at timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

select organization_id, status, starts_at
into v_org_id, v_status, v_starts_at
from public.events where id = p_event_id and deleted_at is null;
if v_org_id is null then
    raise exception 'Événement introuvable' using errcode = '42P01';
end if;

  if not public.is_org_owner_or_admin(v_org_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

  if v_status <> 'draft' then
    raise exception 'Seul un brouillon peut être publié' using errcode = '42501';
end if;

  if v_starts_at < now() then
    raise exception 'L''événement a déjà commencé, impossible de le publier' using errcode = '23514';
end if;

update public.events
set status = 'published'::event_status, updated_at = now()
where id = p_event_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (v_user_id, 'event.publish', 'event', p_event_id, '{}'::jsonb);
end;
$$;
revoke execute on function public.publish_event(uuid) from public;
grant execute on function public.publish_event(uuid) to authenticated;

-- 8. RPC : cancel_event (avec raison)
create or replace function public.cancel_event(
  p_event_id uuid,
  p_reason   text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_org_id uuid;
  v_status event_status;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

select organization_id, status into v_org_id, v_status
from public.events where id = p_event_id and deleted_at is null;
if v_org_id is null then
    raise exception 'Événement introuvable' using errcode = '42P01';
end if;

  if not public.is_org_owner_or_admin(v_org_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

  if v_status = 'cancelled' then
    raise exception 'Événement déjà annulé' using errcode = '42501';
end if;
  if v_status = 'completed' then
    raise exception 'Événement déjà terminé, non annulable' using errcode = '42501';
end if;

  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'Raison d''annulation requise (min 10 caractères)' using errcode = '23514';
end if;

update public.events
set status = 'cancelled'::event_status,
        cancelled_at = now(),
        cancellation_reason = trim(p_reason),
        updated_at = now()
where id = p_event_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id, 'event.cancel', 'event', p_event_id,
           jsonb_build_object('reason', trim(p_reason))
       );
end;
$$;
revoke execute on function public.cancel_event(uuid, text) from public;
grant execute on function public.cancel_event(uuid, text) to authenticated;

-- 9. RPC : delete_event_draft (uniquement pour drafts sans inscriptions)
create or replace function public.delete_event_draft(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_org_id uuid;
  v_status event_status;
  v_reg_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

select organization_id, status, registrations_count
into v_org_id, v_status, v_reg_count
from public.events where id = p_event_id and deleted_at is null;
if v_org_id is null then
    raise exception 'Événement introuvable' using errcode = '42P01';
end if;

  if not public.is_org_owner_or_admin(v_org_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

  if v_status <> 'draft' then
    raise exception 'Seuls les brouillons peuvent être supprimés (sinon, annule l''événement)' using errcode = '42501';
end if;

  if v_reg_count > 0 then
    raise exception 'Impossible de supprimer : il y a des inscriptions' using errcode = '42501';
end if;

update public.events
set deleted_at = now(), updated_at = now()
where id = p_event_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (v_user_id, 'event.delete_draft', 'event', p_event_id, '{}'::jsonb);
end;
$$;
revoke execute on function public.delete_event_draft(uuid) from public;
grant execute on function public.delete_event_draft(uuid) to authenticated;