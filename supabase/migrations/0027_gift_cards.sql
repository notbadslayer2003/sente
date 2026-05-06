-- =============================================================================
-- Sente — V1.5 e-commerce : bons cadeaux dématérialisés
-- =============================================================================
-- Cette migration ajoute :
--   - Table gift_cards : un code par bon cadeau émis, avec son solde courant,
--     son expiration (12 mois), son destinataire et son magasin émetteur.
--   - cart_items.gift_metadata + order_items.gift_metadata : JSONB pour stocker
--     les infos cadeau (recipient_name, recipient_email, message, scope).
--   - RPC gen_gift_card_code() : helper interne pour générer un code 16 chars
--     unique, format K73F-XP9A-2MRL-BQH8.
--   - RPC create_gift_cards_from_paid_order(order_id) : crée les bons cadeaux
--     pour chaque order_item de kind=gift_card. Idempotente.
--   - RPC apply_gift_card_to_order : placeholder pour 5.D (signature posée).
--
-- Hypothèses :
--   - Un produit kind='gift_card' a une variante par valeur (25€, 50€, ...).
--   - Le code est stocké en clair (Q7 décidé).
--   - Expiration 12 mois fixe (Q6 décidé).
--   - Email envoyé en clair, pas de hash (Q6 décidé).
-- =============================================================================


-- =============================================================================
-- 1. Enum gift_card_status
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'gift_card_status') then
create type gift_card_status as enum (
      'active',     -- utilisable, balance > 0
      'used',       -- balance = 0, fully consumed
      'expired',    -- expires_at < now() et jamais utilisé OU balance > 0
      'refunded',   -- annulé suite refund de l'achat (jamais utilisé)
      'cancelled'   -- révoqué admin (cas exceptionnel)
    );
end if;
end$$;


-- =============================================================================
-- 2. Table gift_cards
-- =============================================================================
create table if not exists public.gift_cards (
                                                 id                    uuid primary key default gen_random_uuid(),

    -- Code unique exposé au destinataire (format K73F-XP9A-2MRL-BQH8)
    -- Stocké en clair (Q7), avec contrainte d'unicité.
    code                  text not null,

    -- Magasin émetteur. Un bon cadeau est utilisable UNIQUEMENT chez son émetteur.
    organization_id       uuid not null references public.organizations(id) on delete restrict,

    -- Origine : item de commande qui a généré ce bon. Sert à matcher pour le refund.
    origin_order_item_id  uuid not null unique references public.order_items(id) on delete restrict,

    -- Valeur initiale et solde courant (peut décroître via application_partielle 5.D)
    initial_value_cents   integer not null check (initial_value_cents > 0),
    balance_cents         integer not null check (balance_cents >= 0),

    -- Acheteur (peut être null si guest checkout dans le futur)
    buyer_user_id         uuid references public.profiles(id) on delete set null,

    -- Destinataire : si "Pour moi", recipient_email = email du buyer ; sinon = email saisi
    -- Toujours stocké pour pouvoir renvoyer l'email en cas de besoin SAV.
    recipient_email       public.citext not null,
    recipient_name        text,
    sender_message        text check (sender_message is null or length(sender_message) <= 500),

    -- Expiration calculée à la création (12 mois après emission, Q6)
    expires_at            timestamptz not null,

    -- Statut courant
    status                public.gift_card_status not null default 'active',

    -- Timestamps
    emitted_at            timestamptz not null default now(),
    fully_used_at         timestamptz,
    refunded_at           timestamptz,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),

    -- Contraintes
    constraint gift_cards_code_format_check check (code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
    constraint gift_cards_email_format_check check (recipient_email ~ '^[^@]+@[^@]+\.[^@]+$'),
    constraint gift_cards_balance_consistency check (balance_cents <= initial_value_cents)
    );

-- Code unique (en case sensitive parce qu'on génère uniquement en majuscules)
create unique index if not exists idx_gift_cards_code
    on public.gift_cards(code);

-- Recherche par destinataire (page "Mes bons cadeaux")
create index if not exists idx_gift_cards_recipient_email
    on public.gift_cards(recipient_email)
    where status = 'active';

-- Recherche par buyer (filtre côté profil)
create index if not exists idx_gift_cards_buyer
    on public.gift_cards(buyer_user_id)
    where buyer_user_id is not null;

-- Recherche par magasin (stats émetteur)
create index if not exists idx_gift_cards_organization
    on public.gift_cards(organization_id);

-- Index expiration (cron de cleanup futur)
create index if not exists idx_gift_cards_expires_at
    on public.gift_cards(expires_at)
    where status = 'active';

-- Trigger updated_at
drop trigger if exists tg_gift_cards_updated_at on public.gift_cards;
create trigger tg_gift_cards_updated_at
    before update on public.gift_cards
    for each row execute function public.tg_set_updated_at();

comment on table public.gift_cards is
  'Bons cadeaux dématérialisés émis par un magasin. Un code = une variante de '
  'produit kind=gift_card achetée. Solde décroissant via application au checkout. '
  'Expiration 12 mois. Code stocké en clair (16 chars alphanum, format XXXX-XXXX-XXXX-XXXX).';


-- =============================================================================
-- 3. RLS gift_cards
-- =============================================================================
alter table public.gift_cards enable row level security;
alter table public.gift_cards force row level security;

-- L'acheteur voit ses achats, le destinataire voit ses cadeaux reçus
-- (matching par email du profile)
drop policy if exists "gift_cards read own" on public.gift_cards;
create policy "gift_cards read own" on public.gift_cards
  for select to authenticated
                      using (
                      buyer_user_id = auth.uid()
                      or recipient_email = (
                      select email::public.citext from public.profiles where id = auth.uid()
                      )
                      );

-- Les membres du magasin émetteur voient leurs propres bons cadeaux émis
-- (utile pour les stats / SAV)
drop policy if exists "gift_cards read by issuer" on public.gift_cards;
create policy "gift_cards read by issuer" on public.gift_cards
  for select to authenticated
                      using (public.is_org_member(organization_id));

-- Admins lisent tout
drop policy if exists "gift_cards admin all" on public.gift_cards;
create policy "gift_cards admin all" on public.gift_cards
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- INSERT/UPDATE : uniquement via RPCs security definer
-- Pas de policy INSERT/UPDATE générique = bloqué pour le client
-- (les RPCs bypass RLS via security definer)


-- =============================================================================
-- 4. Étensions cart_items + order_items : gift_metadata
-- =============================================================================
alter table public.cart_items
    add column if not exists gift_metadata jsonb;

alter table public.order_items
    add column if not exists gift_metadata jsonb;

-- Validation côté CHECK : si présent, doit avoir scope + recipient_email
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cart_items_gift_metadata_check'
  ) then
alter table public.cart_items add constraint cart_items_gift_metadata_check
    check (
        gift_metadata is null
            or (
            gift_metadata ? 'scope'
          and gift_metadata->>'scope' in ('self', 'gift')
          and (
            gift_metadata->>'scope' = 'self'
            or (
              gift_metadata ? 'recipient_email'
              and gift_metadata->>'recipient_email' ~ '^[^@]+@[^@]+\.[^@]+$'
            )
          )
            )
        );
end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_gift_metadata_check'
  ) then
alter table public.order_items add constraint order_items_gift_metadata_check
    check (
        gift_metadata is null
            or (
            gift_metadata ? 'scope'
          and gift_metadata->>'scope' in ('self', 'gift')
            )
        );
end if;
end$$;

comment on column public.cart_items.gift_metadata is
  'Si l''item est un bon cadeau, contient {scope: "self"|"gift", recipient_email?, recipient_name?, message?}. NULL pour produits physiques.';
comment on column public.order_items.gift_metadata is
  'Snapshot du gift_metadata au moment de la commande. Sert à create_gift_cards_from_paid_order après paiement.';


-- =============================================================================
-- 5. RPC gen_gift_card_code — helper interne
-- =============================================================================
-- Génère un code 16 chars alphanumériques au format XXXX-XXXX-XXXX-XXXX.
-- Utilise gen_random_bytes pour l'aléa cryptographique.
-- Réessaie en cas de collision (extrêmement rare avec 36^16 possibilités).
-- =============================================================================

create or replace function public.gen_gift_card_code()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_chars text := 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
  -- 33 chars : on exclut O/0/I/1 pour lisibilité
  v_code text;
  v_attempt integer := 0;
  v_part text;
  v_byte integer;
  v_i integer;
begin
  loop
v_attempt := v_attempt + 1;
    if v_attempt > 10 then
      raise exception 'Impossible de générer un code unique après 10 tentatives'
        using errcode = 'XX000';
end if;

    -- Génère 16 chars en 4 groupes de 4
    v_code := '';
for v_i in 1..16 loop
      v_byte := get_byte(gen_random_bytes(1), 0);
      v_code := v_code || substr(v_chars, (v_byte % 33) + 1, 1);
      if v_i in (4, 8, 12) then
        v_code := v_code || '-';
end if;
end loop;

    -- Vérifie unicité
    if not exists (select 1 from public.gift_cards where code = v_code) then
      return v_code;
end if;
end loop;
end;
$$;

revoke execute on function public.gen_gift_card_code() from public;
-- Helper interne, jamais appelé par le client

comment on function public.gen_gift_card_code() is
  'Génère un code de bon cadeau 16 chars alphanum unique au format XXXX-XXXX-XXXX-XXXX. '
  'Caractères : A-Z2-9 sauf O/I (lisibilité). 33^16 ≈ 1.4×10^24 possibilités.';


-- =============================================================================
-- 6. RPC create_gift_cards_from_paid_order
-- =============================================================================
-- Appelée par le webhook Stripe après mark_shop_order_paid.
-- Pour chaque order_item de kind=gift_card, crée une ligne gift_cards avec :
--   - Code unique généré
--   - balance = unit_price (la valeur de la variante)
--   - expires_at = now() + 12 mois
--   - recipient_email/name extraits de gift_metadata (ou customer_email si scope=self)
--
-- Idempotente : skip si une gift_card existe déjà pour cet order_item
-- (via origin_order_item_id UNIQUE).
-- =============================================================================

create or replace function public.create_gift_cards_from_paid_order(
  p_order_id  uuid
)
returns integer  -- nombre de gift_cards créées
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_buyer_user_id   uuid;
  v_buyer_email     text;
  v_magasin_id      uuid;
  v_order_status    text;
  v_item            record;
  v_gift_metadata   jsonb;
  v_scope           text;
  v_recipient_email text;
  v_recipient_name  text;
  v_message         text;
  v_code            text;
  v_quantity        integer;
  v_q               integer;
  v_created_count   integer := 0;
begin
  -- Récupère la commande
select buyer_user_id, magasin_id, status, customer_email
into v_buyer_user_id, v_magasin_id, v_order_status, v_buyer_email
from public.orders
where id = p_order_id;

if v_buyer_user_id is null then
    raise exception 'Commande % introuvable', p_order_id using errcode = '42P01';
end if;

  -- On ne crée des gift_cards que pour des commandes payées (sécurité)
  if v_order_status not in ('paid', 'preparing', 'ready_for_pickup', 'shipped', 'delivered') then
    raise exception 'Commande % pas dans un statut éligible (statut: %)',
      p_order_id, v_order_status using errcode = '22023';
end if;

  -- Itère sur les order_items kind=gift_card
for v_item in
select oi.id, oi.product_id, oi.variant_id, oi.unit_price_cents,
       oi.quantity, oi.gift_metadata,
       p.kind as product_kind
from public.order_items oi
         join public.products p on p.id = oi.product_id
where oi.order_id = p_order_id
  and p.kind = 'gift_card'
    loop
    -- Skip si déjà créé (idempotence)
    -- Vu qu'on peut commander plusieurs unités d'une même variante, on génère
    -- AUTANT de gift_cards que de quantité. Mais origin_order_item_id est UNIQUE,
    -- donc on doit faire attention : on crée 1 gift_card max par order_item.
    --
    -- DÉCISION : pour le MVP, quantity > 1 sur un item gift_card = 1 seul code
    -- avec une valeur multipliée. Si on veut N codes distincts, il faudra
    -- ajouter les items un par un côté UI (ce qui est le comportement par défaut
    -- du checkout : 1 ajout au panier = 1 cart_item = 1 order_item).
    --
    -- Cas limite : si l'acheteur clique 2x "Ajouter au panier" sur la même
    -- variante, add_to_cart incrémente quantity. Ici on crée 1 code de
    -- 2× la valeur. Pas idéal mais documenté.

    if exists (
      select 1 from public.gift_cards
      where origin_order_item_id = v_item.id
    ) then
      continue;  -- déjà créé
end if;

    -- Skip si pas de gift_metadata (cas d'erreur défensif)
    v_gift_metadata := v_item.gift_metadata;
    if v_gift_metadata is null then
      raise warning 'order_item % sans gift_metadata, skip création', v_item.id;
continue;
end if;

    v_scope := coalesce(v_gift_metadata->>'scope', 'self');

    if v_scope = 'gift' then
      v_recipient_email := v_gift_metadata->>'recipient_email';
      v_recipient_name := v_gift_metadata->>'recipient_name';
else
      v_recipient_email := v_buyer_email;
      -- Récup le nom du buyer pour personnalisation email
select coalesce(p.full_name, p.username)
into v_recipient_name
from public.profiles p
where p.id = v_buyer_user_id;
end if;

    if v_recipient_email is null then
      raise warning 'order_item % sans email destinataire, skip', v_item.id;
continue;
end if;

    v_message := v_gift_metadata->>'message';
    v_quantity := v_item.quantity;

    -- Génère le code
    v_code := public.gen_gift_card_code();

insert into public.gift_cards (
    code,
    organization_id,
    origin_order_item_id,
    initial_value_cents,
    balance_cents,
    buyer_user_id,
    recipient_email,
    recipient_name,
    sender_message,
    expires_at
)
values (
           v_code,
           v_magasin_id,
           v_item.id,
           v_item.unit_price_cents * v_quantity,
           v_item.unit_price_cents * v_quantity,
           v_buyer_user_id,
           v_recipient_email::public.citext,
           v_recipient_name,
           v_message,
           now() + interval '12 months'
       );

v_created_count := v_created_count + 1;

    -- Audit
insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_buyer_user_id,
           'gift_card.create',
           'gift_card',
           v_item.id,  -- on log l'order_item pour traçabilité
           jsonb_build_object(
                   'order_id', p_order_id,
                   'magasin_id', v_magasin_id,
                   'value_cents', v_item.unit_price_cents * v_quantity,
                   'scope', v_scope,
                   'recipient_email', v_recipient_email
           )
       );
end loop;

return v_created_count;
end;
$$;

revoke execute on function public.create_gift_cards_from_paid_order(uuid) from public;
-- Appelée uniquement par service_role (webhook)

comment on function public.create_gift_cards_from_paid_order(uuid) is
  'Crée les bons cadeaux pour les order_items kind=gift_card d''une commande payée. '
  'Idempotent (origin_order_item_id UNIQUE). Appelée par webhook Stripe après mark_shop_order_paid.';


-- =============================================================================
-- 7. RPC apply_gift_card_to_cart — placeholder pour 5.D
-- =============================================================================
-- Cette RPC sera implémentée en 5.D. Pour l'instant on pose la signature
-- pour fixer l'API et permettre au front de se construire en parallèle.
-- =============================================================================

create or replace function public.apply_gift_card_to_cart(
  p_cart_id  uuid,
  p_code     text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  raise exception 'apply_gift_card_to_cart : non implémenté. Disponible en 5.D.'
    using errcode = '0A000';  -- "feature not supported"
end;
$$;

revoke execute on function public.apply_gift_card_to_cart(uuid, text) from public;
grant execute on function public.apply_gift_card_to_cart(uuid, text) to authenticated;

comment on function public.apply_gift_card_to_cart(uuid, text) is
  'PLACEHOLDER 5.D. Applique un code bon cadeau au cart pour réduction au checkout.';


-- =============================================================================
-- Fin de la migration 0026
-- =============================================================================