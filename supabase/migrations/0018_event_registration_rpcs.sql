-- =============================================================================
-- Sente — Phase 6.5 session B : RPCs inscription + paiement + refund events
-- =============================================================================

-- 1. RPC : créer une inscription event (gratuit ou en attente de paiement)
-- Crée la registration en statut 'pending' (online_card) ou 'paid' (free) ou 'pending' (on_site_cash)
create or replace function public.register_to_event(
  p_event_id        uuid,
  p_full_name       text,
  p_phone           text,
  p_payment_method  text,
  p_notes           text
)
returns table (registration_id uuid, requires_payment boolean, amount_cents integer)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id        uuid;
  v_user_email     citext;
  v_event          record;
  v_org_default_bps integer;
  v_effective_bps  integer;
  v_registration_id uuid;
  v_existing_count integer;
  v_org_member     boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  -- Email du user (snapshot dans la registration)
select email into v_user_email
from auth.users where id = v_user_id;
if v_user_email is null then
    raise exception 'Email utilisateur introuvable' using errcode = '42P01';
end if;

  if p_full_name is null or length(trim(p_full_name)) < 2 then
    raise exception 'Nom complet requis' using errcode = '23514';
end if;

  if p_payment_method not in ('online_card', 'on_site_cash', 'free') then
    raise exception 'Méthode de paiement invalide' using errcode = '23514';
end if;

  -- Charge l'event
select e.id, e.organization_id, e.status, e.starts_at, e.price_cents,
       e.max_participants, e.registrations_count, e.commission_rate_bps,
       o.stripe_account_id, o.stripe_charges_enabled
into v_event
from public.events e
         join public.organizations o on o.id = e.organization_id
where e.id = p_event_id and e.deleted_at is null;

if v_event.id is null then
    raise exception 'Événement introuvable' using errcode = '42P01';
end if;

  if v_event.status <> 'published' then
    raise exception 'Inscriptions fermées (événement non publié)' using errcode = '42501';
end if;

  if v_event.starts_at < now() then
    raise exception 'Événement passé, inscriptions fermées' using errcode = '42501';
end if;

  -- Anti-double inscription
select count(*) into v_existing_count
from public.event_registrations
where event_id = p_event_id and user_id = v_user_id;
if v_existing_count > 0 then
    raise exception 'Tu es déjà inscrit à cet événement' using errcode = '23505';
end if;

  -- Membres de l'org : pas besoin de s'inscrire
select exists(
    select 1 from public.memberships
    where organization_id = v_event.organization_id
      and user_id = v_user_id
      and accepted_at is not null
      and revoked_at is null
) into v_org_member;
if v_org_member then
    raise exception 'En tant que membre, tu n''as pas besoin de t''inscrire' using errcode = '42501';
end if;

  -- Capacité
  if v_event.max_participants is not null
     and v_event.registrations_count >= v_event.max_participants then
    raise exception 'Événement complet' using errcode = '42501';
end if;

  -- Cohérence méthode / prix
  if v_event.price_cents = 0 and p_payment_method <> 'free' then
    -- Force 'free' pour les events gratuits
    p_payment_method := 'free';
  elsif v_event.price_cents > 0 and p_payment_method = 'free' then
    raise exception 'Événement payant, choisis une méthode de paiement' using errcode = '23514';
end if;

  -- Si paiement online, l'org doit avoir Stripe configuré
  if p_payment_method = 'online_card' then
    if v_event.stripe_account_id is null or v_event.stripe_charges_enabled is not true then
      raise exception 'Le paiement en ligne n''est pas disponible pour cet événement' using errcode = '42501';
end if;
end if;

  -- Détermine le taux de commission effectif
  if v_event.commission_rate_bps is not null then
    v_effective_bps := v_event.commission_rate_bps;
else
    -- Pour les étangs, lire etang_details ; pour les magasins, lire magasin_details
select coalesce(ed.commission_rate_bps, 300) into v_org_default_bps
from public.etang_details ed
where ed.organization_id = v_event.organization_id;

if v_org_default_bps is null then
      -- Magasin : taux par défaut 300 bps en MVP
      v_org_default_bps := 300;
end if;
    v_effective_bps := v_org_default_bps;
end if;

  -- Insertion (bypass RLS via SECURITY DEFINER)
insert into public.event_registrations (
    event_id, user_id, full_name, email, phone,
    payment_method, payment_status,
    paid_amount_cents, sente_commission_cents, sente_commission_rate_bps,
    notes
)
values (
           p_event_id, v_user_id, trim(p_full_name), v_user_email, nullif(trim(coalesce(p_phone, '')), ''),
           p_payment_method,
           case
               when p_payment_method = 'free' then 'paid'::payment_status
               else 'pending'::payment_status
               end,
           0, 0, v_effective_bps,
           nullif(trim(coalesce(p_notes, '')), '')
       )
    returning id into v_registration_id;

-- Audit
insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id, 'event.register', 'event_registration', v_registration_id,
           jsonb_build_object(
                   'event_id', p_event_id,
                   'payment_method', p_payment_method,
                   'amount_cents', v_event.price_cents
           )
       );

return query select
    v_registration_id,
    (p_payment_method = 'online_card')::boolean,
    v_event.price_cents;
end;
$$;
revoke execute on function public.register_to_event(uuid, text, text, text, text) from public;
grant execute on function public.register_to_event(uuid, text, text, text, text) to authenticated;

-- 2. RPC : marquer une inscription comme payée (appelée par le webhook Stripe)
create or replace function public.mark_event_registration_paid(
  p_registration_id uuid,
  p_amount_cents    integer,
  p_commission_cents integer,
  p_stripe_payment_intent_id text,
  p_stripe_charge_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_event_id   uuid;
  v_user_id    uuid;
  v_org_id     uuid;
  v_already_paid boolean;
begin
  -- Idempotence : si déjà payé avec ce PI, on skip
select (payment_status = 'paid'),
       event_id, user_id
into v_already_paid, v_event_id, v_user_id
from public.event_registrations
where id = p_registration_id;

if v_event_id is null then
    raise exception 'Inscription introuvable' using errcode = '42P01';
end if;
  if v_already_paid then return; end if;

select organization_id into v_org_id
from public.events where id = v_event_id;

update public.event_registrations
set payment_status = 'paid',
    paid_amount_cents = p_amount_cents,
    sente_commission_cents = p_commission_cents,
    stripe_payment_intent_id = p_stripe_payment_intent_id,
    stripe_charge_id = p_stripe_charge_id,
    paid_at = now()
where id = p_registration_id;

-- Insère dans payments (table unifiée)
insert into public.payments (
    kind, reference_id, payer_user_id, recipient_org_id,
    amount_cents, sente_commission_cents,
    stripe_payment_intent_id, stripe_charge_id,
    status
)
values (
           'event_registration', p_registration_id, v_user_id, v_org_id,
           p_amount_cents, p_commission_cents,
           p_stripe_payment_intent_id, p_stripe_charge_id,
           'paid'
       )
    on conflict (stripe_payment_intent_id) do nothing;

-- Notif au pêcheur (si l'auteur de la notif est différent de soi-même)
perform public.fn_notify(
    p_recipient_user_id := v_user_id,
    p_type := 'account_action',
    p_target_org_id := v_org_id,
    p_payload := jsonb_build_object(
      'action', 'event_registration_paid',
      'event_id', v_event_id,
      'amount_cents', p_amount_cents
    )
  );

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id, 'event.registration.paid', 'event_registration', p_registration_id,
           jsonb_build_object('amount_cents', p_amount_cents, 'commission_cents', p_commission_cents)
       );
end;
$$;
-- Service role only (appelé depuis webhook)
revoke execute on function public.mark_event_registration_paid(uuid, integer, integer, text, text) from public;
revoke execute on function public.mark_event_registration_paid(uuid, integer, integer, text, text) from authenticated;

-- 3. RPC : enregistrer un refund event
create or replace function public.record_event_refund(
  p_registration_id        uuid,
  p_refund_amount_cents    integer,
  p_commission_refund_cents integer,
  p_reason                 text,
  p_stripe_refund_id       text,
  p_stripe_charge_id       text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id    uuid;
  v_event_id   uuid;
  v_org_id     uuid;
  v_payer_user_id uuid;
  v_paid       integer;
  v_already_refunded integer;
  v_commission integer;
  v_original_payment_id uuid;
  v_new_status payment_status;
  v_new_paid   integer;
  v_new_refunded integer;
  v_new_commission integer;
begin
  v_user_id := auth.uid();

  if p_refund_amount_cents <= 0 then
    raise exception 'Montant de refund invalide' using errcode = '23514';
end if;

select event_id, user_id, paid_amount_cents, refunded_amount_cents, sente_commission_cents
into v_event_id, v_payer_user_id, v_paid, v_already_refunded, v_commission
from public.event_registrations
where id = p_registration_id;
if v_event_id is null then
    raise exception 'Inscription introuvable' using errcode = '42P01';
end if;

  if p_refund_amount_cents > (v_paid - v_already_refunded) then
    raise exception 'Montant supérieur au remboursable (% cents disponibles)', (v_paid - v_already_refunded)
      using errcode = '23514';
end if;

select organization_id into v_org_id
from public.events where id = v_event_id;

-- Trouve le payment originel
select id into v_original_payment_id
from public.payments
where reference_id = p_registration_id
  and kind = 'event_registration'
  and status = 'paid'
order by created_at asc
    limit 1;

v_new_paid := v_paid - p_refund_amount_cents;
  v_new_refunded := v_already_refunded + p_refund_amount_cents;
  v_new_commission := greatest(v_commission - p_commission_refund_cents, 0);

  if v_new_paid <= 0 then
    v_new_status := 'refunded';
else
    v_new_status := 'partial';
end if;

update public.event_registrations
set paid_amount_cents = v_new_paid,
    refunded_amount_cents = v_new_refunded,
    sente_commission_cents = v_new_commission,
    payment_status = v_new_status,
    refund_reason = p_reason,
    refunded_at = now()
where id = p_registration_id;

insert into public.payments (
    kind, reference_id, payer_user_id, recipient_org_id,
    amount_cents, sente_commission_cents,
    stripe_refund_id, stripe_charge_id,
    refunds_parent_id, status
)
values (
           'refund', p_registration_id, v_payer_user_id, v_org_id,
           p_refund_amount_cents, p_commission_refund_cents,
           p_stripe_refund_id, p_stripe_charge_id,
           v_original_payment_id, 'paid'
       )
    on conflict (stripe_refund_id) do nothing;

-- Notif au pêcheur
perform public.fn_notify(
    p_recipient_user_id := v_payer_user_id,
    p_type := 'account_action',
    p_target_org_id := v_org_id,
    p_payload := jsonb_build_object(
      'action', 'event_refund',
      'event_id', v_event_id,
      'amount_cents', p_refund_amount_cents,
      'reason', p_reason
    )
  );

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id, 'event.refund.success', 'event_registration', p_registration_id,
           jsonb_build_object('amount_cents', p_refund_amount_cents, 'commission_cents', p_commission_refund_cents)
       );
end;
$$;
revoke execute on function public.record_event_refund(uuid, integer, integer, text, text, text) from public;
grant execute on function public.record_event_refund(uuid, integer, integer, text, text, text) to authenticated;