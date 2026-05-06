-- =============================================================================
-- Sente — V1.5 e-commerce : RPCs commandes critiques
-- =============================================================================
-- Cette migration ajoute :
--   - Une colonne order_items.refund_reason (manquante pour tracer les refunds
--     partiels avec raison)
--   - 4 RPCs : create_order_from_cart, mark_shop_order_paid, cancel_shop_order,
--     record_order_item_refund
--
-- Patterns alignés sur record_event_refund existante :
--   - payments.kind : 'order' pour le paiement initial, 'refund' pour le refund
--   - payments.status : toujours 'paid' (= opération confirmée)
--   - refunds_parent_id : pointe vers le payment kind='order' d'origine
--   - Notification via fn_notify
--   - Audit via audit_log
-- =============================================================================


-- =============================================================================
-- 0. ALTER order_items : ajout colonne refund_reason
-- =============================================================================
alter table public.order_items
    add column if not exists refund_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_refund_reason_check'
  ) then
alter table public.order_items add constraint order_items_refund_reason_check
    check (refund_reason is null or length(refund_reason) <= 1000);
end if;
end$$;

comment on column public.order_items.refund_reason is
  'Raison du dernier refund partiel sur cet item. Null si jamais refundé.';


-- =============================================================================
-- 1. create_order_from_cart
-- =============================================================================
-- Crée une commande pending_payment depuis un cart. Snapshot prix/commission.
-- Vérifie le stock (sans le réserver). Ne touche PAS au stock ni au cart.
-- Le débit Stripe et la décrémentation stock se font dans mark_shop_order_paid.
-- =============================================================================

create or replace function public.create_order_from_cart(
  p_cart_id           uuid,
  p_delivery_method   public.delivery_method
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id              uuid;
  v_cart_org_id          uuid;
  v_org_stripe_account   text;
  v_org_charges_enabled  boolean;
  v_org_plan             text;
  v_commission_rate_bps  integer;
  v_shop_settings        record;
  v_shipping_cents       integer := 0;
  v_subtotal_cents       integer := 0;
  v_total_cents          integer;
  v_application_fee      integer;
  v_order_id             uuid;
  v_item                 record;
begin
  -- Auth + ownership
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Connecte-toi pour passer commande' using errcode = '42501';
end if;

select organization_id into v_cart_org_id
from public.carts
where id = p_cart_id and user_id = v_user_id;

if v_cart_org_id is null then
    raise exception 'Panier introuvable' using errcode = '42P01';
end if;

  -- Magasin doit accepter les paiements en ligne
select stripe_account_id, stripe_charges_enabled
into v_org_stripe_account, v_org_charges_enabled
from public.organizations
where id = v_cart_org_id;

if v_org_stripe_account is null or v_org_charges_enabled = false then
    raise exception 'Ce magasin n''accepte pas encore les paiements en ligne'
      using errcode = '22023';
end if;

  -- Plan magasin → commission_rate_bps
  --   starter      → 500 bps (5%)
  --   pro          → 250 bps (2.5%)
  --   boutique_plus → 100 bps (1%)
select plan into v_org_plan
from public.magasin_details
where organization_id = v_cart_org_id;

v_commission_rate_bps := case v_org_plan
    when 'pro' then 250
    when 'boutique_plus' then 100
    else 500
end;

  -- Validation delivery_method via shop_settings
select * into v_shop_settings
from public.shop_settings
where organization_id = v_cart_org_id;

if v_shop_settings is null then
    if p_delivery_method <> 'click_collect' then
      raise exception 'Mode de récupération non disponible pour ce magasin'
        using errcode = '22023';
end if;
    v_shipping_cents := 0;
else
    case p_delivery_method
      when 'click_collect' then
        if not v_shop_settings.click_collect_enabled then
          raise exception 'Le retrait en magasin n''est pas activé'
            using errcode = '22023';
end if;
        v_shipping_cents := 0;
when 'shipping_standard' then
        if not v_shop_settings.shipping_standard_enabled then
          raise exception 'La livraison standard n''est pas activée'
            using errcode = '22023';
end if;
        v_shipping_cents := v_shop_settings.shipping_standard_fee_cents;
when 'shipping_local' then
        if not v_shop_settings.shipping_local_enabled then
          raise exception 'La livraison locale n''est pas activée'
            using errcode = '22023';
end if;
        v_shipping_cents := v_shop_settings.shipping_local_fee_cents;
end case;
end if;

  -- Validation items + calcul subtotal
for v_item in
select
    ci.id          as cart_item_id,
    ci.quantity    as qty,
    v.id           as variant_id,
    v.sku          as variant_sku,
    v.price_cents  as unit_price,
    v.stock_quantity as stock,
    v.is_active    as variant_active,
    v.options      as variant_options,
    p.id           as product_id,
    p.name         as product_name,
    p.status       as product_status,
    p.deleted_at   as product_deleted_at,
    p.organization_id as product_org_id
from public.cart_items ci
         join public.product_variants v on v.id = ci.product_variant_id
         join public.products p on p.id = v.product_id
where ci.cart_id = p_cart_id
    loop
    if not v_item.variant_active then
      raise exception 'La variante "%" n''est plus disponible',
        v_item.product_name using errcode = '22023';
end if;

    if v_item.product_status <> 'published' or v_item.product_deleted_at is not null then
      raise exception 'Le produit "%" n''est plus disponible',
        v_item.product_name using errcode = '22023';
end if;

    if v_item.product_org_id <> v_cart_org_id then
      raise exception 'Incohérence panier (item d''un autre magasin)'
        using errcode = '22023';
end if;

    if v_item.stock is not null and v_item.stock < v_item.qty then
      raise exception
        'Stock insuffisant pour "%" (% disponible(s), % demandé(s))',
        v_item.product_name, v_item.stock, v_item.qty
        using errcode = '22023';
end if;

    v_subtotal_cents := v_subtotal_cents + (v_item.unit_price * v_item.qty);
end loop;

  if v_subtotal_cents = 0 then
    raise exception 'Panier vide' using errcode = '22023';
end if;

  -- Total + commission (commission UNIQUEMENT sur le subtotal, pas le port — Q7 du recap)
  v_total_cents := v_subtotal_cents + v_shipping_cents;
  v_application_fee := round(v_subtotal_cents * v_commission_rate_bps / 10000.0);

  -- Crée la commande
insert into public.orders (
    magasin_id,
    buyer_user_id,
    status,
    delivery_method,
    subtotal_cents,
    shipping_cents,
    total_cents,
    commission_rate_bps,
    sente_commission_cents
)
values (
           v_cart_org_id,
           v_user_id,
           'pending_payment',
           p_delivery_method,
           v_subtotal_cents,
           v_shipping_cents,
           v_total_cents,
           v_commission_rate_bps,
           v_application_fee
       )
    returning id into v_order_id;

-- Crée les order_items avec snapshots
insert into public.order_items (
    order_id,
    product_id,
    variant_id,
    product_name,
    variant_name,
    variant_options,
    sku,
    unit_price_cents,
    quantity,
    line_total_cents
)
select
    v_order_id,
    v.product_id,
    v.id,
    p.name,
    case
        when v.options = '{}'::jsonb then null
        else (
            select string_agg(value, ' / ')
            from jsonb_each_text(v.options)
        )
        end,
    v.options,
    v.sku,
    v.price_cents,
    ci.quantity,
    v.price_cents * ci.quantity
from public.cart_items ci
         join public.product_variants v on v.id = ci.product_variant_id
         join public.products p on p.id = v.product_id
where ci.cart_id = p_cart_id;

-- Audit
insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id, 'order.create', 'order', v_order_id,
           jsonb_build_object(
                   'cart_id', p_cart_id,
                   'subtotal_cents', v_subtotal_cents,
                   'total_cents', v_total_cents,
                   'application_fee_cents', v_application_fee,
                   'delivery_method', p_delivery_method
           )
       );

-- Retour pour l'edge function checkout
return jsonb_build_object(
        'order_id', v_order_id,
        'total_cents', v_total_cents,
        'subtotal_cents', v_subtotal_cents,
        'shipping_cents', v_shipping_cents,
        'organization_id', v_cart_org_id,
        'stripe_account_id', v_org_stripe_account,
        'application_fee_cents', v_application_fee,
        'delivery_method', p_delivery_method
       );
end;
$$;

revoke execute on function public.create_order_from_cart(uuid, public.delivery_method) from public;
grant execute on function public.create_order_from_cart(uuid, public.delivery_method) to authenticated;

comment on function public.create_order_from_cart(uuid, public.delivery_method) is
  'Crée une commande pending_payment depuis un cart. Snapshot prix/commission. '
  'Vérifie stock (sans réservation). Stock décrémenté plus tard par mark_shop_order_paid.';


-- =============================================================================
-- 2. mark_shop_order_paid
-- =============================================================================
-- Appelée par le webhook Stripe après paiement réussi.
-- Décrémente stock, snapshot customer, vide cart, INSERT payments kind='order'.
-- =============================================================================

create or replace function public.mark_shop_order_paid(
  p_order_id                  uuid,
  p_stripe_session_id         text,
  p_stripe_payment_intent_id  text,
  p_stripe_charge_id          text,
  p_customer_email            text,
  p_customer_name             text,
  p_customer_phone            text,
  p_shipping_address          jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_buyer_id        uuid;
  v_magasin_id      uuid;
  v_status          order_status;
  v_total_cents     integer;
  v_commission_cents integer;
  v_item            record;
  v_updated_count   integer;
begin
  -- Lock + check status
select buyer_user_id, magasin_id, status, total_cents, sente_commission_cents
into v_buyer_id, v_magasin_id, v_status, v_total_cents, v_commission_cents
from public.orders
where id = p_order_id
    for update;

if v_buyer_id is null then
    raise exception 'Commande % introuvable', p_order_id using errcode = '42P01';
end if;

  -- Idempotent : si déjà paid, no-op
  if v_status = 'paid' then
    return;
end if;

  if v_status <> 'pending_payment' then
    raise exception 'Commande % n''est pas en attente de paiement (statut: %)',
      p_order_id, v_status using errcode = '22023';
end if;

  -- Décrémente stock atomiquement
for v_item in
select oi.id, oi.variant_id, oi.quantity, oi.product_name
from public.order_items oi
where oi.order_id = p_order_id
    loop
    if v_item.variant_id is null then
      raise exception 'Variante introuvable pour "%": le produit a été supprimé',
        v_item.product_name using errcode = '22023';
end if;

update public.product_variants
set stock_quantity = stock_quantity - v_item.quantity
where id = v_item.variant_id
  and (stock_quantity is null or stock_quantity >= v_item.quantity);

get diagnostics v_updated_count = row_count;

if v_updated_count = 0 then
      raise exception
        'Stock insuffisant pour "%" au moment du paiement (race condition). Refund nécessaire.',
        v_item.product_name
        using errcode = '22023';
end if;
end loop;

  -- Update commande
update public.orders
set status = 'paid',
    paid_at = now(),
    stripe_session_id = p_stripe_session_id,
    stripe_payment_intent_id = p_stripe_payment_intent_id,
    stripe_charge_id = p_stripe_charge_id,
    customer_email = nullif(p_customer_email, ''),
    customer_name = nullif(p_customer_name, ''),
    customer_phone = nullif(p_customer_phone, ''),
    shipping_address = p_shipping_address,
    updated_at = now()
where id = p_order_id;

-- INSERT payments kind='order' (pour pouvoir matcher les refunds plus tard)
insert into public.payments (
    kind,
    reference_id,
    payer_user_id,
    recipient_org_id,
    amount_cents,
    sente_commission_cents,
    currency,
    stripe_payment_intent_id,
    stripe_charge_id,
    status
)
values (
           'order',
           p_order_id,
           v_buyer_id,
           v_magasin_id,
           v_total_cents,
           v_commission_cents,
           'eur',
           p_stripe_payment_intent_id,
           p_stripe_charge_id,
           'paid'
       )
    on conflict (stripe_payment_intent_id) do nothing;

-- Vide les items du cart correspondant à cette commande
delete from public.cart_items ci
    using public.carts c, public.order_items oi
where ci.cart_id = c.id
  and c.user_id = v_buyer_id
  and c.organization_id = v_magasin_id
  and ci.product_variant_id = oi.variant_id
  and oi.order_id = p_order_id;

-- Si le cart est devenu vide, on le delete aussi
delete from public.carts c
where c.user_id = v_buyer_id
  and c.organization_id = v_magasin_id
  and not exists (
    select 1 from public.cart_items ci where ci.cart_id = c.id
);

-- Audit
insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_buyer_id, 'order.paid', 'order', p_order_id,
           jsonb_build_object(
                   'stripe_session_id', p_stripe_session_id,
                   'stripe_payment_intent_id', p_stripe_payment_intent_id,
                   'amount_cents', v_total_cents
           )
       );
end;
$$;

revoke execute on function public.mark_shop_order_paid(
    uuid, text, text, text, text, text, text, jsonb
    ) from public;

comment on function public.mark_shop_order_paid(uuid, text, text, text, text, text, text, jsonb) is
  'Marque commande payée (appelée par webhook Stripe). Décrémente stock atomique, '
  'INSERT payments kind=order, vide cart. Rollback si stock insuffisant.';


-- =============================================================================
-- 3. cancel_shop_order
-- =============================================================================

create or replace function public.cancel_shop_order(
  p_order_id  uuid,
  p_reason    text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id           uuid;
  v_buyer_id          uuid;
  v_magasin_id        uuid;
  v_status            order_status;
  v_is_buyer          boolean;
  v_is_magasin_member boolean;
  v_is_admin          boolean;
  v_item              record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

select buyer_user_id, magasin_id, status
into v_buyer_id, v_magasin_id, v_status
from public.orders
where id = p_order_id
    for update;

if v_buyer_id is null then
    raise exception 'Commande introuvable' using errcode = '42P01';
end if;

  v_is_buyer := (v_buyer_id = v_user_id);
  v_is_magasin_member := public.is_org_member(v_magasin_id);
  v_is_admin := public.is_app_admin();

  if not (v_is_buyer or v_is_magasin_member or v_is_admin) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

  if v_status = 'cancelled' then
    return;
end if;

  if v_status = 'delivered' then
    raise exception 'Une commande livrée ne peut plus être annulée. Refund partiel ?'
      using errcode = '22023';
end if;

  if v_status = 'refunded' then
    raise exception 'Commande déjà remboursée' using errcode = '22023';
end if;

  if v_is_buyer and not v_is_admin and v_status not in ('pending_payment', 'paid') then
    raise exception 'Tu ne peux plus annuler cette commande. Contacte le magasin.'
      using errcode = '42501';
end if;

  -- Restaure le stock si la commande avait été payée
  if v_status in ('paid', 'preparing', 'ready_for_pickup', 'shipped') then
    for v_item in
select variant_id, quantity, refunded_quantity
from public.order_items
where order_id = p_order_id
  and variant_id is not null
    loop
update public.product_variants
set stock_quantity = coalesce(stock_quantity, 0) + (v_item.quantity - v_item.refunded_quantity)
where id = v_item.variant_id
  and stock_quantity is not null;
end loop;
end if;

update public.orders
set status = 'cancelled',
    cancelled_at = now(),
    refund_reason = nullif(p_reason, ''),
    updated_at = now()
where id = p_order_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id, 'order.cancel', 'order', p_order_id,
           jsonb_build_object(
                   'previous_status', v_status,
                   'reason', p_reason,
                   'cancelled_by', case
                                       when v_is_buyer then 'buyer'
                                       when v_is_magasin_member then 'magasin'
                                       when v_is_admin then 'admin'
                                       else 'unknown'
                       end
           )
       );
end;
$$;

revoke execute on function public.cancel_shop_order(uuid, text) from public;
grant execute on function public.cancel_shop_order(uuid, text) to authenticated;

comment on function public.cancel_shop_order(uuid, text) is
  'Annule une commande. Restaure stock si déjà payée. Buyer peut annuler '
  'jusqu''au statut paid uniquement. Magasin/admin à tout moment sauf delivered/refunded.';


-- =============================================================================
-- 4. record_order_item_refund
-- =============================================================================
-- Aligné sur le pattern de record_event_refund :
--   - INSERT payments kind='refund', status='paid', refunds_parent_id pointe
--     sur le payment kind='order' d'origine
--   - Notification au buyer via fn_notify
--   - Audit
-- =============================================================================

create or replace function public.record_order_item_refund(
  p_order_item_id            uuid,
  p_refund_quantity          integer,
  p_refund_amount_cents      integer,
  p_commission_refund_cents  integer,
  p_reason                   text,
  p_stripe_refund_id         text,
  p_stripe_charge_id         text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id              uuid;
  v_order_id             uuid;
  v_variant_id           uuid;
  v_quantity             integer;
  v_already_refunded_qty integer;
  v_already_refunded_cents integer;
  v_line_total           integer;
  v_magasin_id           uuid;
  v_buyer_id             uuid;
  v_original_payment_id  uuid;
  v_is_magasin_member    boolean;
  v_is_admin             boolean;
begin
  v_user_id := auth.uid();

  -- Récupère l'item + commande parente
select oi.order_id, oi.variant_id, oi.quantity, oi.refunded_quantity,
       oi.refunded_amount_cents, oi.line_total_cents,
       o.magasin_id, o.buyer_user_id
into v_order_id, v_variant_id, v_quantity, v_already_refunded_qty,
    v_already_refunded_cents, v_line_total, v_magasin_id, v_buyer_id
from public.order_items oi
         join public.orders o on o.id = oi.order_id
where oi.id = p_order_item_id
    for update;

if v_order_id is null then
    raise exception 'Item de commande introuvable' using errcode = '42P01';
end if;

  -- Auth : magasin de la commande, ou admin, ou service_role (webhook = v_user_id NULL)
  if v_user_id is not null then
    v_is_magasin_member := public.is_org_member(v_magasin_id);
    v_is_admin := public.is_app_admin();
    if not (v_is_magasin_member or v_is_admin) then
      raise exception 'Accès refusé' using errcode = '42501';
end if;
end if;

  -- Validations
  if p_refund_quantity <= 0 or p_refund_quantity > (v_quantity - v_already_refunded_qty) then
    raise exception 'Quantité de refund invalide (max % unité(s) restante(s))',
      v_quantity - v_already_refunded_qty using errcode = '22023';
end if;

  if p_refund_amount_cents <= 0
     or p_refund_amount_cents > (v_line_total - v_already_refunded_cents) then
    raise exception 'Montant de refund invalide (max % cents restant)',
      v_line_total - v_already_refunded_cents using errcode = '22023';
end if;

  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'Raison de refund requise (min 10 caractères)'
      using errcode = '22023';
end if;

  -- Trouve le payment d'origine pour lier en refunds_parent_id
select id into v_original_payment_id
from public.payments
where reference_id = v_order_id
  and kind = 'order'
  and status = 'paid'
order by created_at asc
    limit 1;

-- Update l'order_item (le trigger recompute orders.refunded_amount_cents auto)
update public.order_items
set refunded_quantity = refunded_quantity + p_refund_quantity,
    refunded_amount_cents = refunded_amount_cents + p_refund_amount_cents,
    refund_reason = p_reason
where id = p_order_item_id;

-- Restaure le stock
if v_variant_id is not null then
update public.product_variants
set stock_quantity = coalesce(stock_quantity, 0) + p_refund_quantity
where id = v_variant_id
  and stock_quantity is not null;
end if;

  -- INSERT payments kind='refund', status='paid'
insert into public.payments (
    kind,
    reference_id,
    payer_user_id,
    recipient_org_id,
    amount_cents,
    sente_commission_cents,
    currency,
    stripe_charge_id,
    stripe_refund_id,
    refunds_parent_id,
    status
)
values (
           'refund',
           v_order_id,
           v_buyer_id,
           v_magasin_id,
           p_refund_amount_cents,
           p_commission_refund_cents,
           'eur',
           p_stripe_charge_id,
           p_stripe_refund_id,
           v_original_payment_id,
           'paid'
       )
    on conflict (stripe_refund_id) do nothing;

-- Notification au buyer
perform public.fn_notify(
    p_recipient_user_id := v_buyer_id,
    p_type := 'account_action',
    p_target_org_id := v_magasin_id,
    p_payload := jsonb_build_object(
      'action', 'order_refund',
      'order_id', v_order_id,
      'amount_cents', p_refund_amount_cents,
      'quantity', p_refund_quantity,
      'reason', p_reason
    )
  );

  -- Audit
insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           coalesce(v_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
           'order.refund.success',
           'order_item',
           p_order_item_id,
           jsonb_build_object(
                   'order_id', v_order_id,
                   'refund_quantity', p_refund_quantity,
                   'refund_amount_cents', p_refund_amount_cents,
                   'commission_refund_cents', p_commission_refund_cents,
                   'reason', p_reason,
                   'stripe_refund_id', p_stripe_refund_id,
                   'triggered_by', case when v_user_id is null then 'webhook' else 'user' end
           )
       );
end;
$$;

revoke execute on function public.record_order_item_refund(
    uuid, integer, integer, integer, text, text, text
    ) from public;
grant execute on function public.record_order_item_refund(
  uuid, integer, integer, integer, text, text, text
) to authenticated;

comment on function public.record_order_item_refund(uuid, integer, integer, integer, text, text, text) is
  'Refund partiel sur un order_item. Aligné sur record_event_refund : INSERT '
  'payments kind=refund avec refunds_parent_id, restaure stock proportionnel, '
  'notifie buyer via fn_notify, trace en audit_log.';

-- =============================================================================
-- Fin de la migration 0024
-- =============================================================================