-- =============================================================================
-- 0033_subscriptions.sql
--
-- Ajoute les colonnes billing/subscription sur organizations.
-- Ces colonnes vivent là car ce sont des données cross-type (étang ou magasin)
-- liées au compte Stripe Customer plateforme Sente, pas à Stripe Connect.
--
-- À NE PAS CONFONDRE :
-- - organizations.stripe_account_id  → Connected Account (le magasin/étang vend
--                                       via Sente, encaisse ses ventes)
-- - organizations.stripe_customer_id → Customer (le magasin/étang ACHÈTE un
--                                       abonnement Sente)
-- =============================================================================

begin;

-- Type pour le status de subscription. On garde simple : ces 4 états couvrent
-- 95% des cas. past_due = paiement échoué, on garde l'accès en grace period.
create type public.subscription_status as enum (
    'free',
    'active',
    'past_due',
    'canceled'
);

-- Ajout des colonnes billing
alter table public.organizations
    add column stripe_customer_id text null,
    add column stripe_subscription_id text null,
    add column subscription_status public.subscription_status not null default 'free',
    add column subscription_current_period_end timestamptz null,
    add column subscription_cancel_at_period_end boolean not null default false;

-- Index sur stripe_customer_id et stripe_subscription_id pour les lookups webhook
-- (le webhook reçoit ces IDs et doit retrouver l'org rapidement)
create index idx_organizations_stripe_customer_id
    on public.organizations(stripe_customer_id)
    where stripe_customer_id is not null;

create index idx_organizations_stripe_subscription_id
    on public.organizations(stripe_subscription_id)
    where stripe_subscription_id is not null;

-- Contrainte d'unicité : un customer Stripe est lié à une seule org
-- (defense in depth contre les doublons accidentels)
alter table public.organizations
    add constraint organizations_stripe_customer_id_unique
        unique (stripe_customer_id);

alter table public.organizations
    add constraint organizations_stripe_subscription_id_unique
        unique (stripe_subscription_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: lookup org par stripe_customer_id (pour les webhooks)
-- ─────────────────────────────────────────────────────────────────────────────
-- Le webhook reçoit un customer ou subscription Stripe et a besoin de retrouver
-- l'org sans avoir à passer par RLS. On bypass via SECURITY DEFINER.
create or replace function public.find_org_by_stripe_customer(
    p_customer_id text
) returns uuid
language sql
security definer
set search_path = public, pg_catalog
as $$
select id from public.organizations
where stripe_customer_id = p_customer_id
    limit 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: appliquer un changement de subscription depuis un webhook
-- ─────────────────────────────────────────────────────────────────────────────
-- Update atomique : sync status, period_end, cancel_at_period_end + plan effectif
-- côté etang_details ou magasin_details. SECURITY DEFINER car appelée depuis
-- le webhook avec service role.
create or replace function public.apply_subscription_update(
    p_org_id uuid,
    p_subscription_id text,
    p_status public.subscription_status,
    p_current_period_end timestamptz,
    p_cancel_at_period_end boolean,
    p_plan_id text
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_org_type text;
begin
    -- Met à jour les infos billing sur l'org
update public.organizations
set
    stripe_subscription_id = p_subscription_id,
    subscription_status = p_status,
    subscription_current_period_end = p_current_period_end,
    subscription_cancel_at_period_end = p_cancel_at_period_end,
    updated_at = now()
where id = p_org_id
    returning org_type into v_org_type;

if v_org_type is null then
        raise exception 'Organization % introuvable', p_org_id;
end if;

    -- Sync le plan effectif côté détails (selon type d'org).
    -- Si la subscription est active/past_due → applique le plan acheté.
    -- Si la subscription est canceled → revient au plan gratuit.
    if p_status in ('active', 'past_due') then
        if v_org_type = 'etang' then
update public.etang_details
set plan = p_plan_id::etang_plan,
                commission_rate_bps = case
                    when p_plan_id = 'crm' then 300
                    else 0
end,
                updated_at = now()
            where organization_id = p_org_id;
        elsif v_org_type = 'magasin' then
update public.magasin_details
set plan = p_plan_id::magasin_plan,
                commission_rate_bps = case
                    when p_plan_id = 'pro' then 200
                    else 500
end,
                updated_at = now()
            where organization_id = p_org_id;
end if;
    elsif p_status = 'canceled' then
        if v_org_type = 'etang' then
update public.etang_details
set plan = 'vitrine'::etang_plan,
                commission_rate_bps = 0,
                updated_at = now()
where organization_id = p_org_id;
elsif v_org_type = 'magasin' then
update public.magasin_details
set plan = 'starter'::magasin_plan,
                commission_rate_bps = 500,
                updated_at = now()
where organization_id = p_org_id;
end if;
end if;

    -- Audit log
insert into public.audit_log (
    actor_user_id, action, target_type, target_id, payload
) values (
             null,
             'subscription.updated',
             'organization',
             p_org_id,
             jsonb_build_object(
                     'subscription_id', p_subscription_id,
                     'status', p_status,
                     'plan_id', p_plan_id,
                     'cancel_at_period_end', p_cancel_at_period_end
             )
         );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: link customer ID après création (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
-- Appelée par la server action lors du premier checkout. Si l'org a déjà un
-- customer, on retourne l'existant (ne pas créer en double dans Stripe).
create or replace function public.link_org_stripe_customer(
    p_org_id uuid,
    p_stripe_customer_id text
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
update public.organizations
set stripe_customer_id = p_stripe_customer_id,
    updated_at = now()
where id = p_org_id
  and stripe_customer_id is null;
end;
$$;

commit;