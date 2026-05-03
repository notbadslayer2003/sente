-- =============================================================================
-- Sente — Refunds sur abonnements pêcheurs
-- =============================================================================
-- Quand l'étang rembourse, Stripe rend l'argent au pêcheur ET Sente restitue
-- sa commission (refund_application_fee=true). On enregistre le refund dans
-- payments (kind='refund') et on ajuste pecheur_subscriptions.
-- =============================================================================

-- 1. Étend le CHECK constraint sur payments.kind pour autoriser 'refund'
alter table public.payments
drop constraint if exists payments_kind_check;
alter table public.payments
    add constraint payments_kind_check
        check (kind in ('etang_subscription','order','event_registration','platform_fee','refund'));

-- 2. Colonnes refund sur pecheur_subscriptions
alter table public.pecheur_subscriptions
    add column if not exists refunded_amount_cents integer not null default 0
    check (refunded_amount_cents >= 0),
    add column if not exists refund_reason text
    check (refund_reason is null or length(refund_reason) between 10 and 1000),
    add column if not exists refunded_at timestamptz;

comment on column public.pecheur_subscriptions.refunded_amount_cents is
  'Cumul des refunds appliqués (en cents). 0 si aucun refund.';
comment on column public.pecheur_subscriptions.refund_reason is
  'Raison textuelle du dernier refund. Pour audit.';

-- 3. Colonnes refund sur payments
alter table public.payments
    add column if not exists stripe_refund_id text unique
    check (stripe_refund_id is null or stripe_refund_id ~ '^re_'),
    add column if not exists refunds_parent_id uuid
    references public.payments(id) on delete set null;

comment on column public.payments.refunds_parent_id is
  'Pointe vers la payment originelle quand kind=refund.';

-- 4. RPC record_refund
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
           -p_refund_amount_cents,
           -p_commission_refund_cents,
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
revoke execute on function public.record_refund(uuid, integer, integer, text, text, text) from public;
grant execute on function public.record_refund(uuid, integer, integer, text, text, text) to authenticated;