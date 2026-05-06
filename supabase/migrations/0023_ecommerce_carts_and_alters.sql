-- =============================================================================
-- Sente — V1.5 e-commerce : panier, snapshots commande, RPCs panier
-- =============================================================================
-- Cette migration :
--   1. Étend les tables `orders` et `order_items` avec les colonnes manquantes
--      pour supporter le checkout V1.5 (delivery_method, snapshots customer,
--      refund tracking).
--   2. Crée les tables `carts` et `cart_items` avec RLS strictes (chaque user
--      ne voit que ses propres paniers).
--   3. Crée un trigger pour recalculer automatiquement
--      `orders.refunded_amount_cents` à partir des refunds par item.
--   4. Crée 6 RPCs panier : add, update qty, remove, clear, get_or_create
--      helper, cleanup_old_carts (purge cron).
--
-- À NOTER : les RPCs critiques pour la commande (create_order_from_cart,
-- mark_shop_order_paid, cancel_shop_order, record_order_item_refund) sont
-- dans la migration 0023 séparée pour clarté.
-- =============================================================================

-- =============================================================================
-- 1. Enum delivery_method
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'delivery_method') then
create type delivery_method as enum (
      'click_collect',
      'shipping_standard',
      'shipping_local'
    );
end if;
end$$;

comment on type public.delivery_method is
  'Mode de récupération d''une commande. click_collect = retrait en magasin, '
  'shipping_standard = transporteur (poste, GLS), shipping_local = magasin '
  'livre lui-même dans sa zone.';


-- =============================================================================
-- 2. ALTER orders : ajout colonnes manquantes
-- =============================================================================
alter table public.orders
    add column if not exists delivery_method public.delivery_method,
    add column if not exists stripe_session_id text,
    add column if not exists customer_email public.citext,
    add column if not exists customer_name text,
    add column if not exists customer_phone text,
    add column if not exists paid_at timestamptz,
    add column if not exists refunded_amount_cents integer not null default 0;

-- Contraintes ajoutées séparément (pour pouvoir IF NOT EXISTS sur les checks)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_stripe_session_id_check'
  ) then
alter table public.orders add constraint orders_stripe_session_id_check
    check (stripe_session_id is null or stripe_session_id ~ '^cs_');
end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_customer_email_check'
  ) then
alter table public.orders add constraint orders_customer_email_check
    check (customer_email is null or customer_email ~ '^[^@]+@[^@]+\.[^@]+$');
end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_customer_name_check'
  ) then
alter table public.orders add constraint orders_customer_name_check
    check (customer_name is null or length(customer_name) <= 200);
end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_customer_phone_check'
  ) then
alter table public.orders add constraint orders_customer_phone_check
    check (customer_phone is null or length(customer_phone) <= 30);
end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_refunded_amount_cents_check'
  ) then
alter table public.orders add constraint orders_refunded_amount_cents_check
    check (refunded_amount_cents >= 0);
end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_stripe_session_id_unique'
  ) then
alter table public.orders add constraint orders_stripe_session_id_unique
    unique (stripe_session_id);
end if;
end$$;

-- Index sur stripe_session_id (utile pour le webhook qui fetch la commande)
create index if not exists idx_orders_stripe_session
    on public.orders(stripe_session_id)
    where stripe_session_id is not null;

comment on column public.orders.delivery_method is
  'Mode de récupération choisi au checkout. NULL pour les anciennes commandes '
  'pré-V1.5 (events, abonnements pêcheurs). Toujours renseigné pour les commandes '
  'shop e-commerce.';
comment on column public.orders.stripe_session_id is
  'ID de session Stripe Checkout. Permet au webhook de matcher la commande.';
comment on column public.orders.customer_email is
  'Snapshot email au moment du paiement. Survit à la suppression du compte buyer.';
comment on column public.orders.refunded_amount_cents is
  'Montant total remboursé (somme des refunds partiels). Calculé automatiquement '
  'par trigger depuis order_items.refunded_amount_cents.';


-- =============================================================================
-- 3. ALTER order_items : snapshots et refunds par item
-- =============================================================================
alter table public.order_items
    add column if not exists variant_options jsonb not null default '{}'::jsonb,
    add column if not exists sku text,
    add column if not exists refunded_quantity integer not null default 0,
    add column if not exists refunded_amount_cents integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_sku_check'
  ) then
alter table public.order_items add constraint order_items_sku_check
    check (sku is null or length(sku) <= 64);
end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_refunded_quantity_check'
  ) then
alter table public.order_items add constraint order_items_refunded_quantity_check
    check (refunded_quantity >= 0 and refunded_quantity <= quantity);
end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_refunded_amount_check'
  ) then
alter table public.order_items add constraint order_items_refunded_amount_check
    check (refunded_amount_cents >= 0 and refunded_amount_cents <= line_total_cents);
end if;
end$$;

comment on column public.order_items.variant_options is
  'Snapshot des options (ex: {"Taille":"12ft","Puissance":"3lb"}) au moment '
  'de la commande. Utile si la variante est modifiée ou supprimée après.';
comment on column public.order_items.sku is
  'Snapshot SKU pour ERP / facturation. Survit à la suppression de la variante.';
comment on column public.order_items.refunded_quantity is
  'Nombre d''unités remboursées (refund partiel). 0 = aucun, jusqu''à quantity.';


-- =============================================================================
-- 4. Trigger : recompute orders.refunded_amount_cents
-- =============================================================================
-- Quand un order_item est refundé partiellement, on met à jour le total
-- agrégé sur orders. Évite de recalculer à la lecture.

create or replace function public.fn_recompute_order_refunded_amount()
returns trigger
language plpgsql
as $$
declare
v_order_id uuid;
  v_total integer;
begin
  -- Détermine quel order recalculer (cas INSERT/UPDATE/DELETE)
  if tg_op = 'DELETE' then
    v_order_id := old.order_id;
else
    v_order_id := new.order_id;
end if;

  -- Somme tous les refunded_amount_cents des items de cet order
select coalesce(sum(refunded_amount_cents), 0) into v_total
from public.order_items
where order_id = v_order_id;

update public.orders
set refunded_amount_cents = v_total,
    -- Si tout est remboursé, marque comme refunded (mais pas si déjà cancelled)
    status = case
                 when v_total >= total_cents - shipping_cents and status not in ('cancelled', 'refunded')
                     then 'refunded'::order_status
                 else status
        end,
    refunded_at = case
                      when v_total >= total_cents - shipping_cents and refunded_at is null
                          then now()
                      else refunded_at
        end,
    updated_at = now()
where id = v_order_id;

return coalesce(new, old);
end;
$$;

comment on function public.fn_recompute_order_refunded_amount() is
  'Trigger : recalcule orders.refunded_amount_cents quand un order_item est '
  'refundé. Bonus : transitionne le statut à refunded si tout est remboursé.';

drop trigger if exists tg_order_items_recompute_refund on public.order_items;
create trigger tg_order_items_recompute_refund
    after insert or update of refunded_amount_cents or delete
                    on public.order_items
                        for each row
                        execute function public.fn_recompute_order_refunded_amount();


-- =============================================================================
-- 5. Table carts
-- =============================================================================
-- Un panier par couple (user, magasin). Login obligatoire pour ajouter au
-- panier (pas de cart anonyme). Purge automatique après 30j d'inactivité
-- (RPC cleanup_old_carts à appeler par cron).

create table if not exists public.carts (
                                            id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references public.profiles(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (user_id, organization_id)
    );

comment on table public.carts is
  'Panier d''un user pour un magasin donné. Un user peut avoir plusieurs '
  'paniers en parallèle (un par magasin). Pas de cart anonyme : login '
  'obligatoire avant l''ajout au panier.';

create index if not exists idx_carts_user
    on public.carts(user_id, updated_at desc);

create index if not exists idx_carts_org
    on public.carts(organization_id, updated_at desc);

drop trigger if exists tg_carts_updated_at on public.carts;
create trigger tg_carts_updated_at
    before update on public.carts
    for each row execute function public.tg_set_updated_at();

alter table public.carts enable row level security;
alter table public.carts force row level security;

drop policy if exists "carts read own" on public.carts;
create policy "carts read own" on public.carts
  for select to authenticated
                      using (user_id = auth.uid());

drop policy if exists "carts insert own" on public.carts;
create policy "carts insert own" on public.carts
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "carts update own" on public.carts;
create policy "carts update own" on public.carts
  for update to authenticated
                                  using (user_id = auth.uid())
      with check (user_id = auth.uid());

drop policy if exists "carts delete own" on public.carts;
create policy "carts delete own" on public.carts
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "carts admin all" on public.carts;
create policy "carts admin all" on public.carts
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());


-- =============================================================================
-- 6. Table cart_items
-- =============================================================================
-- Lignes d'un panier. Un (cart_id, product_variant_id) ne peut apparaître
-- qu'une fois : si l'user re-ajoute la même variante, on incrémente la quantité.

create table if not exists public.cart_items (
                                                 id                  uuid primary key default gen_random_uuid(),
    cart_id             uuid not null references public.carts(id) on delete cascade,
    product_variant_id  uuid not null references public.product_variants(id) on delete cascade,
    quantity            integer not null
    check (quantity > 0 and quantity <= 99),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (cart_id, product_variant_id)
    );

comment on table public.cart_items is
  'Items d''un panier. Quantité 1-99. Pas de duplication : si même variante '
  'ajoutée 2 fois, on incrémente quantity via la RPC add_to_cart.';

create index if not exists idx_cart_items_cart
    on public.cart_items(cart_id);

create index if not exists idx_cart_items_variant
    on public.cart_items(product_variant_id);

drop trigger if exists tg_cart_items_updated_at on public.cart_items;
create trigger tg_cart_items_updated_at
    before update on public.cart_items
    for each row execute function public.tg_set_updated_at();

-- Trigger : touche le cart parent à chaque modif d'item (pour la purge 30j)
create or replace function public.fn_touch_cart_on_item_change()
returns trigger
language plpgsql
as $$
begin
update public.carts
set updated_at = now()
where id = coalesce(new.cart_id, old.cart_id);
return coalesce(new, old);
end;
$$;

drop trigger if exists tg_cart_items_touch_cart on public.cart_items;
create trigger tg_cart_items_touch_cart
    after insert or update or delete
                    on public.cart_items
                        for each row execute function public.fn_touch_cart_on_item_change();

alter table public.cart_items enable row level security;
alter table public.cart_items force row level security;

drop policy if exists "cart_items read own" on public.cart_items;
create policy "cart_items read own" on public.cart_items
  for select to authenticated
                      using (
                      exists (
                      select 1 from public.carts c
                      where c.id = cart_id and c.user_id = auth.uid()
                      )
                      );

drop policy if exists "cart_items insert own" on public.cart_items;
create policy "cart_items insert own" on public.cart_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "cart_items update own" on public.cart_items;
create policy "cart_items update own" on public.cart_items
  for update to authenticated
                                  using (
                                  exists (
                                  select 1 from public.carts c
                                  where c.id = cart_id and c.user_id = auth.uid()
                                  )
                                  )
      with check (
                                  exists (
                                  select 1 from public.carts c
                                  where c.id = cart_id and c.user_id = auth.uid()
                                  )
                                  );

drop policy if exists "cart_items delete own" on public.cart_items;
create policy "cart_items delete own" on public.cart_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "cart_items admin all" on public.cart_items;
create policy "cart_items admin all" on public.cart_items
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());


-- =============================================================================
-- 7. RPCs panier
-- =============================================================================

-- 7.1 Helper interne : récupère ou crée le cart pour (user, org)
create or replace function public.fn_get_or_create_cart(
  p_user_id         uuid,
  p_organization_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_cart_id uuid;
begin
  -- Tente de récupérer le cart existant
select id into v_cart_id
from public.carts
where user_id = p_user_id and organization_id = p_organization_id;

if v_cart_id is not null then
    return v_cart_id;
end if;

  -- Crée si pas existant
insert into public.carts (user_id, organization_id)
values (p_user_id, p_organization_id)
    returning id into v_cart_id;

return v_cart_id;
end;
$$;
revoke execute on function public.fn_get_or_create_cart(uuid, uuid) from public;
-- Helper interne, pas accessible depuis le client


-- 7.2 Ajout au panier
-- Si la même variante est déjà dans le cart, on incrémente la quantité.
-- Validation : variante active + produit publié + magasin du cart matche.
create or replace function public.add_to_cart(
  p_product_variant_id uuid,
  p_quantity           integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id    uuid;
  v_cart_id    uuid;
  v_org_id     uuid;
  v_item_id    uuid;
  v_existing_qty integer;
  v_new_qty    integer;
  v_stock      integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Connecte-toi pour ajouter au panier' using errcode = '42501';
end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then
    raise exception 'Quantité invalide (1-99)' using errcode = '23514';
end if;

  -- Récupère l'org du produit + vérifie qu'il est publié et la variante active
select p.organization_id, v.stock_quantity
into v_org_id, v_stock
from public.product_variants v
         join public.products p on p.id = v.product_id
where v.id = p_product_variant_id
  and v.is_active = true
  and p.status = 'published'
  and p.deleted_at is null;

if v_org_id is null then
    raise exception 'Produit indisponible' using errcode = '42P01';
end if;

  -- Récupère ou crée le cart de cet user pour ce magasin
  v_cart_id := public.fn_get_or_create_cart(v_user_id, v_org_id);

  -- Cherche un item existant (même variante)
select id, quantity into v_item_id, v_existing_qty
from public.cart_items
where cart_id = v_cart_id and product_variant_id = p_product_variant_id;

if v_item_id is not null then
    -- Incrémente
    v_new_qty := v_existing_qty + p_quantity;
    if v_new_qty > 99 then
      raise exception 'Maximum 99 unités par variante dans le panier'
        using errcode = '23514';
end if;
    -- Check stock (si pas illimité)
    if v_stock is not null and v_new_qty > v_stock then
      raise exception 'Stock insuffisant (% disponible(s))', v_stock
        using errcode = '23514';
end if;

update public.cart_items
set quantity = v_new_qty
where id = v_item_id;
else
    -- Check stock pour insertion
    if v_stock is not null and p_quantity > v_stock then
      raise exception 'Stock insuffisant (% disponible(s))', v_stock
        using errcode = '23514';
end if;

insert into public.cart_items (cart_id, product_variant_id, quantity)
values (v_cart_id, p_product_variant_id, p_quantity)
    returning id into v_item_id;
end if;

return v_item_id;
end;
$$;
revoke execute on function public.add_to_cart(uuid, integer) from public;
grant execute on function public.add_to_cart(uuid, integer) to authenticated;

comment on function public.add_to_cart(uuid, integer) is
  'Ajoute une variante au panier de l''user (login requis). Crée le cart pour '
  'le magasin si pas existant. Si même variante déjà présente, incrémente '
  'la quantité. Vérifie stock à l''ajout (mais pas de réservation).';


-- 7.3 Update quantité d'un cart_item
-- quantity = 0 → on supprime le cart_item (raccourci UX)
create or replace function public.update_cart_item_quantity(
  p_cart_item_id uuid,
  p_quantity     integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id  uuid;
  v_cart_id  uuid;
  v_variant_id uuid;
  v_stock    integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  if p_quantity is null or p_quantity < 0 or p_quantity > 99 then
    raise exception 'Quantité invalide (0-99)' using errcode = '23514';
end if;

  -- Vérifie que l'item appartient au user et récupère la variante
select ci.cart_id, ci.product_variant_id, v.stock_quantity
into v_cart_id, v_variant_id, v_stock
from public.cart_items ci
         join public.carts c on c.id = ci.cart_id
         join public.product_variants v on v.id = ci.product_variant_id
where ci.id = p_cart_item_id and c.user_id = v_user_id;

if v_cart_id is null then
    raise exception 'Item de panier introuvable' using errcode = '42P01';
end if;

  if p_quantity = 0 then
delete from public.cart_items where id = p_cart_item_id;
return;
end if;

  -- Check stock
  if v_stock is not null and p_quantity > v_stock then
    raise exception 'Stock insuffisant (% disponible(s))', v_stock
      using errcode = '23514';
end if;

update public.cart_items
set quantity = p_quantity
where id = p_cart_item_id;
end;
$$;
revoke execute on function public.update_cart_item_quantity(uuid, integer) from public;
grant execute on function public.update_cart_item_quantity(uuid, integer) to authenticated;


-- 7.4 Suppression explicite d'un item
create or replace function public.remove_cart_item(
  p_cart_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_count   integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

delete from public.cart_items ci
    using public.carts c
where ci.id = p_cart_item_id
  and ci.cart_id = c.id
  and c.user_id = v_user_id;

get diagnostics v_count = row_count;
if v_count = 0 then
    raise exception 'Item de panier introuvable' using errcode = '42P01';
end if;
end;
$$;
revoke execute on function public.remove_cart_item(uuid) from public;
grant execute on function public.remove_cart_item(uuid) to authenticated;


-- 7.5 Vide un cart entier
create or replace function public.clear_cart(
  p_cart_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_count   integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  -- Vérifie ownership avant de vider
  if not exists (
    select 1 from public.carts
    where id = p_cart_id and user_id = v_user_id
  ) then
    raise exception 'Panier introuvable' using errcode = '42P01';
end if;

delete from public.cart_items where cart_id = p_cart_id;
end;
$$;
revoke execute on function public.clear_cart(uuid) from public;
grant execute on function public.clear_cart(uuid) to authenticated;


-- 7.6 Cleanup carts inactifs (cron)
-- Purge les carts qui n'ont pas bougé depuis 30 jours.
-- À appeler par une Edge Function cron quotidienne.
create or replace function public.cleanup_old_carts()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_deleted_count integer;
begin
  -- Réservé aux app_admins (la cron utilisera un service_role qui bypass RLS,
  -- mais on garde le check par sécurité si appelé manuellement)
  if not public.is_app_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
end if;

delete from public.carts
where updated_at < now() - interval '30 days';

get diagnostics v_deleted_count = row_count;
return v_deleted_count;
end;
$$;
revoke execute on function public.cleanup_old_carts() from public;
grant execute on function public.cleanup_old_carts() to authenticated;

comment on function public.cleanup_old_carts() is
  'Purge les paniers inactifs depuis 30 jours. À appeler quotidiennement par '
  'une Edge Function cron (avec service_role pour bypass RLS).';

-- =============================================================================
-- Fin de la migration 0022
-- =============================================================================