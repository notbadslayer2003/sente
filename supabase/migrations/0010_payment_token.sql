-- =============================================================================
-- Sente — Tokens de paiement pour abonnements pêcheurs
-- =============================================================================
-- Quand l'étang envoie un lien de paiement à un pêcheur, on génère un token
-- aléatoire dont on stocke le hash SHA256. Le pêcheur clique le lien dans
-- son email, on retrouve l'abonnement via le hash, on crée un Checkout Stripe.
-- =============================================================================

alter table public.pecheur_subscriptions
    add column payment_token_hash       text unique,
  add column payment_token_expires_at timestamptz,
  add column payment_token_used_at    timestamptz;

create index idx_pecheur_subs_payment_token
    on public.pecheur_subscriptions(payment_token_hash)
    where payment_token_hash is not null and payment_token_used_at is null;

comment on column public.pecheur_subscriptions.payment_token_hash is
  'SHA256 hex du token clair envoyé par email. Le clair n''est jamais persisté.';

-- =============================================================================
-- RPC pour créer un token de paiement (par staff étang)
-- =============================================================================
create or replace function public.create_payment_token(
  p_subscription_id uuid,
  p_token_hash      text,
  p_expires_at      timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_sub     record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  if p_token_hash is null or length(p_token_hash) <> 64 then
    raise exception 'Hash invalide' using errcode = '23514';
end if;
  if p_expires_at <= now() then
    raise exception 'Date d''expiration dans le passé' using errcode = '23514';
end if;

  -- Charge l'abonnement
select id, etang_id, payment_status, price_cents, paid_amount_cents
into v_sub
from public.pecheur_subscriptions
where id = p_subscription_id;
if not found then
    raise exception 'Abonnement introuvable' using errcode = '42P01';
end if;

  -- L'utilisateur doit être membre de l'étang
  if not public.is_org_member(v_sub.etang_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

  -- Refuse de générer un lien si déjà payé/refundé/cancelled
  if v_sub.payment_status in ('paid', 'refunded', 'cancelled') then
    raise exception 'Cet abonnement n''est pas en attente de paiement (statut : %)', v_sub.payment_status
      using errcode = '23514';
end if;

  -- Refuse si plus rien à payer
  if v_sub.paid_amount_cents >= v_sub.price_cents then
    raise exception 'Cet abonnement est déjà entièrement payé'
      using errcode = '23514';
end if;

update public.pecheur_subscriptions
set payment_token_hash       = p_token_hash,
    payment_token_expires_at = p_expires_at,
    payment_token_used_at    = null,
    updated_at               = now()
where id = p_subscription_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'payment.token.create',
           'pecheur_subscription',
           p_subscription_id,
           jsonb_build_object('expires_at', p_expires_at)
       );
end;
$$;
revoke execute on function public.create_payment_token(uuid, text, timestamptz) from public;
grant execute on function public.create_payment_token(uuid, text, timestamptz) to authenticated;

-- =============================================================================
-- RPC appelée par le webhook (service_role) après checkout réussi
-- Met à jour l'abonnement + insère dans payments
-- =============================================================================
create or replace function public.mark_subscription_paid(
  p_subscription_id      uuid,
  p_amount_cents         integer,
  p_commission_cents     integer,
  p_commission_rate_bps  integer,
  p_stripe_payment_intent_id text,
  p_stripe_charge_id     text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_sub  record;
begin
  -- Pas de check auth.uid() : appelée par service_role depuis webhook signé Stripe.

select id, etang_id, payer_user_id_from_subscription(p_subscription_id) as payer_id
into v_sub
from public.pecheur_subscriptions
where id = p_subscription_id;
-- la fonction n'existe pas, on bypass le pattern, simplifions :
end;
$$;
-- ON ANNULE cette fonction et on la réécrit plus simplement ci-dessous

drop function if exists public.mark_subscription_paid(uuid, integer, integer, integer, text, text);

create or replace function public.mark_subscription_paid(
  p_subscription_id           uuid,
  p_amount_cents              integer,
  p_commission_cents          integer,
  p_commission_rate_bps       integer,
  p_stripe_payment_intent_id  text,
  p_stripe_charge_id          text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_etang_id        uuid;
  v_pecheur_user_id uuid;
  v_new_paid        integer;
  v_price           integer;
  v_new_status      payment_status;
begin
  -- Charge l'abonnement
select etang_id, pecheur_user_id, paid_amount_cents + p_amount_cents, price_cents
into v_etang_id, v_pecheur_user_id, v_new_paid, v_price
from public.pecheur_subscriptions
where id = p_subscription_id;
if v_etang_id is null then
    raise exception 'Abonnement introuvable' using errcode = '42P01';
end if;

  -- Calcul du nouveau statut
  if v_new_paid >= v_price then
    v_new_status := 'paid';
else
    v_new_status := 'partial';
end if;

  -- Update abonnement
update public.pecheur_subscriptions
set paid_amount_cents          = v_new_paid,
    payment_status             = v_new_status,
    paid_at                    = case when v_new_status = 'paid' then now() else paid_at end,
    sente_commission_cents     = sente_commission_cents + p_commission_cents,
    sente_commission_rate_bps  = p_commission_rate_bps,
    stripe_payment_intent_id   = p_stripe_payment_intent_id,
    payment_token_used_at      = now(),
    payment_method             = 'online_card',
    updated_at                 = now()
where id = p_subscription_id;

-- Insère dans payments (table unifiée)
insert into public.payments (
    kind, reference_id, payer_user_id, recipient_org_id,
    amount_cents, sente_commission_cents,
    stripe_payment_intent_id, stripe_charge_id, status
)
values (
           'etang_subscription',
           p_subscription_id,
           v_pecheur_user_id,
           v_etang_id,
           p_amount_cents,
           p_commission_cents,
           p_stripe_payment_intent_id,
           p_stripe_charge_id,
           'paid'
       )
    on conflict (stripe_payment_intent_id) do nothing;

-- Audit
insert into public.audit_log (action, target_type, target_id, payload)
values (
           'payment.subscription.success',
           'pecheur_subscription',
           p_subscription_id,
           jsonb_build_object(
                   'amount_cents', p_amount_cents,
                   'commission_cents', p_commission_cents,
                   'new_status', v_new_status::text,
                   'stripe_payment_intent_id', p_stripe_payment_intent_id
           )
       );
end;
$$;
revoke execute on function public.mark_subscription_paid(uuid, integer, integer, integer, text, text) from public;
-- Volontairement pas de GRANT à authenticated : seul service_role peut appeler.