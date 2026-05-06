-- =============================================================================
-- Sente — V1.5 e-commerce : RPC refund frais de livraison
-- =============================================================================
-- Ajoute :
--   - Une RPC `record_shipping_refund` pour rembourser les frais de port,
--     séparée de record_order_item_refund (pas d'order_item parent).
--   - Une RPC `record_full_order_refund` pour le bouton "Tout rembourser"
--     qui combine refund de tous les items + port en une transaction.
--
-- Pattern aligné sur record_order_item_refund :
--   - INSERT payments kind='refund' avec refunds_parent_id
--   - Notification au buyer via fn_notify
--   - Audit
-- =============================================================================


-- =============================================================================
-- 1. record_shipping_refund — rembourse les frais de port d'une commande
-- =============================================================================

create or replace function public.record_shipping_refund(
  p_order_id                 uuid,
  p_refund_amount_cents      integer,
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
  v_buyer_id             uuid;
  v_magasin_id           uuid;
  v_shipping_cents       integer;
  v_already_refunded     integer;
  v_max_refundable       integer;
  v_original_payment_id  uuid;
  v_is_magasin_member    boolean;
  v_is_admin             boolean;
begin
  v_user_id := auth.uid();

  -- Récupère la commande
select buyer_user_id, magasin_id, shipping_cents, refunded_amount_cents
into v_buyer_id, v_magasin_id, v_shipping_cents, v_already_refunded
from public.orders
where id = p_order_id
    for update;

if v_buyer_id is null then
    raise exception 'Commande introuvable' using errcode = '42P01';
end if;

  -- Auth : magasin de la commande, ou admin, ou service_role (webhook)
  if v_user_id is not null then
    v_is_magasin_member := public.is_org_member(v_magasin_id);
    v_is_admin := public.is_app_admin();
    if not (v_is_magasin_member or v_is_admin) then
      raise exception 'Accès refusé' using errcode = '42501';
end if;
end if;

  -- Validations
  if v_shipping_cents = 0 then
    raise exception 'Pas de frais de livraison sur cette commande'
      using errcode = '22023';
end if;

  -- Le port n'est refundable qu'une seule fois en V1 (pas de refund partiel
  -- du port). On vérifie qu'il n'y a pas déjà un refund "shipping" tracé.
  -- Pour ça, on cherche dans payments les refunds liés à cette commande
  -- et avec metadata = 'shipping' (on l'ajoutera côté caller).
  if exists (
    select 1 from public.payments
    where reference_id = p_order_id
      and kind = 'refund'
      and stripe_refund_id is not null
      and raw_event ? 'sente_refund_target'
      and raw_event->>'sente_refund_target' = 'shipping'
  ) then
    raise exception 'Frais de livraison déjà remboursés sur cette commande'
      using errcode = '22023';
end if;

  if p_refund_amount_cents <= 0 or p_refund_amount_cents > v_shipping_cents then
    raise exception 'Montant invalide (max % cents)', v_shipping_cents
      using errcode = '22023';
end if;

  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'Raison de remboursement requise (min 10 caractères)'
      using errcode = '22023';
end if;

  -- Trouve le payment d'origine
select id into v_original_payment_id
from public.payments
where reference_id = p_order_id
  and kind = 'order'
  and status = 'paid'
order by created_at asc
    limit 1;

-- Update orders.refunded_amount_cents (le trigger sur order_items NE va PAS
-- se déclencher pour un refund de port, on update manuellement)
update public.orders
set refunded_amount_cents = refunded_amount_cents + p_refund_amount_cents,
    updated_at = now()
where id = p_order_id;

-- INSERT payments avec marker raw_event pour distinguer "shipping" vs "item"
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
    status,
    raw_event
)
values (
           'refund',
           p_order_id,
           v_buyer_id,
           v_magasin_id,
           p_refund_amount_cents,
           0,  -- pas de commission sur le port (Q7 du recap : commission only on subtotal)
           'eur',
           p_stripe_charge_id,
           p_stripe_refund_id,
           v_original_payment_id,
           'paid',
           jsonb_build_object(
                   'sente_refund_target', 'shipping',
                   'reason', p_reason
           )
       )
    on conflict (stripe_refund_id) do nothing;

-- Notification buyer
perform public.fn_notify(
    p_recipient_user_id := v_buyer_id,
    p_type := 'account_action',
    p_target_org_id := v_magasin_id,
    p_payload := jsonb_build_object(
      'action', 'order_shipping_refund',
      'order_id', p_order_id,
      'amount_cents', p_refund_amount_cents,
      'reason', p_reason
    )
  );

  -- Audit
insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           coalesce(v_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
           'order.shipping_refund',
           'order',
           p_order_id,
           jsonb_build_object(
                   'amount_cents', p_refund_amount_cents,
                   'reason', p_reason,
                   'stripe_refund_id', p_stripe_refund_id
           )
       );
end;
$$;

revoke execute on function public.record_shipping_refund(uuid, integer, text, text, text) from public;
grant execute on function public.record_shipping_refund(uuid, integer, text, text, text) to authenticated;

comment on function public.record_shipping_refund(uuid, integer, text, text, text) is
  'Enregistre un refund des frais de livraison d''une commande (séparé des '
  'refunds par item). Pas de commission sur le port (Q7 recap V1.5).';

-- =============================================================================
-- Fin de la migration 0025
-- =============================================================================