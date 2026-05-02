-- =============================================================================
-- Sente — Workflow de soumission/validation des organizations
-- =============================================================================

-- 1. Soumission par l'owner/admin de l'org : draft -> pending_review
-- -----------------------------------------------------------------------------
create or replace function public.submit_organization_for_review(
  p_org_id uuid
)
returns table (organization_id uuid, new_status org_status)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_org     record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  -- L'utilisateur doit être owner/admin de l'org
  if not public.is_org_owner_or_admin(p_org_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

  -- Charger l'org
select id, name, status, description, address, contact_email, contact_phone, photos
into v_org
from public.organizations
where id = p_org_id and deleted_at is null;
if not found then
    raise exception 'Organisation introuvable' using errcode = '42P01';
end if;

  -- Status doit être draft
  if v_org.status <> 'draft' then
    raise exception 'L''organisation n''est pas en brouillon (status actuel : %)', v_org.status
      using errcode = '23514';
end if;

  -- Vérif minimaux : description >= 50, adresse, au moins un canal de contact
  if v_org.description is null or length(v_org.description) < 50 then
    raise exception 'Description trop courte (50 caractères minimum)'
      using errcode = '23514';
end if;
  if v_org.address is null or length(trim(v_org.address)) = 0 then
    raise exception 'Adresse manquante' using errcode = '23514';
end if;
  if v_org.contact_email is null and v_org.contact_phone is null then
    raise exception 'Au moins un email ou téléphone de contact requis'
      using errcode = '23514';
end if;

  -- Update + audit
update public.organizations
set status = 'pending_review', updated_at = now()
where id = p_org_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id, 'organization.submit_review', 'organization', p_org_id,
           jsonb_build_object('previous_status', v_org.status)
       );

return query select p_org_id, 'pending_review'::org_status;
end;
$$;
revoke execute on function public.submit_organization_for_review(uuid) from public;
grant execute on function public.submit_organization_for_review(uuid) to authenticated;

-- 2. Validation par un app_admin : pending_review -> active
-- -----------------------------------------------------------------------------
create or replace function public.approve_organization(
  p_org_id uuid,
  p_note   text default null
)
returns table (organization_id uuid, new_status org_status)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_old_status org_status;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;
  if not public.is_app_admin() then
    raise exception 'Accès admin requis' using errcode = '42501';
end if;

select status into v_old_status
from public.organizations where id = p_org_id and deleted_at is null;
if not found then
    raise exception 'Organisation introuvable' using errcode = '42P01';
end if;

update public.organizations
set status = 'active', updated_at = now()
where id = p_org_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id, 'organization.approve', 'organization', p_org_id,
           jsonb_build_object('previous_status', v_old_status, 'note', p_note)
       );

return query select p_org_id, 'active'::org_status;
end;
$$;
revoke execute on function public.approve_organization(uuid, text) from public;
grant execute on function public.approve_organization(uuid, text) to authenticated;

-- 3. Rejet par un app_admin : pending_review -> draft (avec note)
-- -----------------------------------------------------------------------------
create or replace function public.reject_organization(
  p_org_id uuid,
  p_reason text
)
returns table (organization_id uuid, new_status org_status)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_old_status org_status;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;
  if not public.is_app_admin() then
    raise exception 'Accès admin requis' using errcode = '42501';
end if;
  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'Raison du rejet requise (10 caractères minimum)'
      using errcode = '23514';
end if;

select status into v_old_status
from public.organizations where id = p_org_id and deleted_at is null;
if not found then
    raise exception 'Organisation introuvable' using errcode = '42P01';
end if;

update public.organizations
set status = 'draft', updated_at = now()
where id = p_org_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id, 'organization.reject', 'organization', p_org_id,
           jsonb_build_object('previous_status', v_old_status, 'reason', p_reason)
       );

return query select p_org_id, 'draft'::org_status;
end;
$$;
revoke execute on function public.reject_organization(uuid, text) from public;
grant execute on function public.reject_organization(uuid, text) to authenticated;