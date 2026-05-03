-- =============================================================================
-- Sente — Fix : payments stockés en positif, signe via kind
-- =============================================================================

-- Pas de relâchement du check >= 0 sur amount_cents et sente_commission_cents.
-- À la place, on stocke toujours en positif, et on interprète selon le kind.

-- Réécrit la RPC record_refund pour stocker en positif
create or replace function public.record_refund(
  p_subscription_id    uuid,
  p_refund_amount_cents integer,
  p_commission_refund_cents integer,
  p_reason             text,
  p_stripe_refund_id   text,
  p_stripe_charge_id   text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id          uuid;
  v_etang_id         uuid;
  v_pecheur_user_id  uuid;
  v_paid             integer;
  v_already_refunded integer;
  v_commission       integer;
  v_price            integer;
  v_original_payment_id uuid;
  v_new_status       payment_status;
  v_new_paid         integer;
  v_new_refunded     integer;
  v_new_commission   integer;
begin
  v_user_id := auth.uid();

  if p_refund_amount_cents <= 0 then
    raise exception 'Montant de refund invalide' using errcode = '23514';
end if;

select etang_id, pecheur_user_id, paid_amount_cents, refunded_amount_cents,
       sente_commission_cents, price_cents
into v_etang_id, v_pecheur_user_id, v_paid, v_already_refunded, v_commission, v_price
from public.pecheur_subscriptions
where id = p_subscription_id;
if not found then
    raise exception 'Abonnement introuvable' using errcode = '42P01';
end if;

  if p_refund_amount_cents > (v_paid - v_already_refunded) then
    raise exception 'Montant supérieur au montant remboursable (% cents disponibles)', (v_paid - v_already_refunded)
      using errcode = '23514';
end if;

select id into v_original_payment_id
from public.payments
where reference_id = p_subscription_id
  and kind = 'etang_subscription'
  and status = 'paid'
order by created_at asc
    limit 1;

v_new_paid := v_paid - p_refund_amount_cents;
  v_new_refunded := v_already_refunded + p_refund_amount_cents;
  v_new_commission := greatest(v_commission - p_commission_refund_cents, 0);

  if v_new_paid <= 0 then
    v_new_status := 'refunded';
  elsif v_new_paid < v_price then
    v_new_status := 'partial';
else
    v_new_status := 'paid';
end if;

update public.pecheur_subscriptions
set paid_amount_cents      = v_new_paid,
    refunded_amount_cents  = v_new_refunded,
    sente_commission_cents = v_new_commission,
    payment_status         = v_new_status,
    refund_reason          = p_reason,
    refunded_at            = now(),
    updated_at             = now()
where id = p_subscription_id;

-- IMPORTANT : montants stockés en POSITIF.
-- Le kind='refund' indique que c'est un mouvement sortant.
insert into public.payments (
    kind, reference_id, payer_user_id, recipient_org_id,
    amount_cents, sente_commission_cents,
    stripe_refund_id, stripe_charge_id,
    refunds_parent_id, status
)
values (
           'refund',
           p_subscription_id,
           v_pecheur_user_id,
           v_etang_id,
           p_refund_amount_cents,           -- positif
           p_commission_refund_cents,       -- positif
           p_stripe_refund_id,
           p_stripe_charge_id,
           v_original_payment_id,
           'paid'
       )
    on conflict (stripe_refund_id) do nothing;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'payment.refund.success',
           'pecheur_subscription',
           p_subscription_id,
           jsonb_build_object(
                   'refund_amount_cents', p_refund_amount_cents,
                   'commission_refund_cents', p_commission_refund_cents,
                   'new_status', v_new_status::text,
                   'reason', p_reason,
                   'stripe_refund_id', p_stripe_refund_id
           )
       );
end;
$$;