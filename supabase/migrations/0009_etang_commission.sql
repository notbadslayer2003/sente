-- =============================================================================
-- Sente — Commission Sente sur les abonnements étang
-- =============================================================================
-- Commission par étang en basis points (300 = 3%).
-- Modifiable uniquement par les app_admins (RLS via fonction d'update dédiée).
-- Snapshot pris au moment du paiement (cf. pecheur_subscriptions.sente_commission_rate_bps).
-- =============================================================================

alter table public.etang_details
    add column commission_rate_bps integer not null default 300
        check (commission_rate_bps between 0 and 10000);

comment on column public.etang_details.commission_rate_bps is
  'Commission Sente sur abonnements en ligne, en basis points. Modifiable par app_admin uniquement.';

-- RPC pour qu'un app_admin puisse modifier la commission d'un étang.
create or replace function public.set_etang_commission_rate(
  p_org_id   uuid,
  p_rate_bps integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id   uuid;
  v_old_rate  integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;
  if not public.is_app_admin() then
    raise exception 'Accès admin requis' using errcode = '42501';
end if;

  if p_rate_bps is null or p_rate_bps < 0 or p_rate_bps > 10000 then
    raise exception 'Taux invalide (0-10000 bps)' using errcode = '23514';
end if;

  -- Récupère l'ancien taux pour audit
select commission_rate_bps into v_old_rate
from public.etang_details
where organization_id = p_org_id;
if not found then
    raise exception 'Étang introuvable' using errcode = '42P01';
end if;

update public.etang_details
set commission_rate_bps = p_rate_bps,
    updated_at = now()
where organization_id = p_org_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'etang.commission.update',
           'organization',
           p_org_id,
           jsonb_build_object(
                   'previous_rate_bps', v_old_rate,
                   'new_rate_bps', p_rate_bps
           )
       );
end;
$$;
revoke execute on function public.set_etang_commission_rate(uuid, integer) from public;
grant execute on function public.set_etang_commission_rate(uuid, integer) to authenticated;