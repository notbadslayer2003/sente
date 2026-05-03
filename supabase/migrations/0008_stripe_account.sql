-- =============================================================================
-- Sente — RPC pour mettre à jour stripe_account_id sur une org
-- =============================================================================
-- Stripe nous renvoie l'account ID après création. On le persiste en DB
-- via RPC pour bénéficier des checks d'autorisation et de l'audit log.
-- =============================================================================

create or replace function public.set_stripe_account_id(
  p_org_id            uuid,
  p_stripe_account_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  if not public.is_org_owner_or_admin(p_org_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

  if p_stripe_account_id is null or p_stripe_account_id !~ '^acct_' then
    raise exception 'Stripe account ID invalide' using errcode = '23514';
end if;

  -- Refuse de remplacer un account_id différent (sécurité : un seul compte par org)
  if exists (
    select 1 from public.organizations
    where id = p_org_id
      and stripe_account_id is not null
      and stripe_account_id <> p_stripe_account_id
  ) then
    raise exception 'Un compte Stripe est déjà attaché à cette organisation. Contacte le support pour le remplacer.'
      using errcode = '23505';
end if;

update public.organizations
set stripe_account_id = p_stripe_account_id,
    updated_at = now()
where id = p_org_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'stripe.account.created',
           'organization',
           p_org_id,
           jsonb_build_object('stripe_account_id', p_stripe_account_id)
       );
end;
$$;
revoke execute on function public.set_stripe_account_id(uuid, text) from public;
grant execute on function public.set_stripe_account_id(uuid, text) to authenticated;

-- =============================================================================
-- Mise à jour des flags KYC depuis le webhook Stripe (service_role uniquement)
-- =============================================================================
-- Cette fonction est appelée par le webhook handler avec service_role.
-- Pas de check auth.uid() ici car les webhooks sont signés par Stripe.

create or replace function public.update_stripe_account_status(
  p_stripe_account_id      text,
  p_charges_enabled        boolean,
  p_payouts_enabled        boolean,
  p_details_submitted      boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
update public.organizations
set stripe_charges_enabled = p_charges_enabled,
    stripe_payouts_enabled = p_payouts_enabled,
    stripe_onboarded       = p_details_submitted,
    updated_at             = now()
where stripe_account_id = p_stripe_account_id;

insert into public.audit_log (action, target_type, payload)
values (
           'stripe.account.updated',
           'stripe_account',
           jsonb_build_object(
                   'account_id', p_stripe_account_id,
                   'charges_enabled', p_charges_enabled,
                   'payouts_enabled', p_payouts_enabled,
                   'details_submitted', p_details_submitted
           )
       );
end;
$$;
revoke execute on function public.update_stripe_account_status(text, boolean, boolean, boolean) from public;
-- Volontairement pas de GRANT à authenticated : seul service_role peut l'appeler.