-- =============================================================================
-- Sente — Stored procedure pour signup étang/magasin
-- =============================================================================
-- Crée une organization + un membership owner en une seule transaction.
-- Appelée par supabase.rpc('create_organization_for_owner', {...}) côté client
-- juste après auth.signUp().
--
-- Sécurité :
-- - SECURITY DEFINER + search_path verrouillé (anti hijack)
-- - REVOKE EXECUTE FROM public, GRANT EXECUTE TO authenticated uniquement
-- - Vérifie auth.uid() (l'utilisateur doit être connecté)
-- - L'utilisateur ne peut créer une org QU'EN tant qu'owner pour lui-même
-- - Status forcé à 'draft' (admin Sente fait passer 'active' après vérif)
-- - Slug normalisé + validé (la fonction is_valid_slug() est déjà en place)
-- - Limite anti-spam : max 5 orgs créées par user
-- =============================================================================

create or replace function public.create_organization_for_owner(
  p_org_type      org_type,
  p_name          text,
  p_slug          text,
  p_country       country_code,
  p_contact_email text default null,
  p_contact_phone text default null
)
returns table (
  organization_id uuid,
  organization_slug text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id     uuid;
  v_org_id      uuid;
  v_owner_count integer;
  v_normalized_slug text;
begin
  -- 1. L'appelant doit être authentifié
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  -- 2. Le profile doit exister (créé par le trigger handle_new_user)
  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Profil utilisateur introuvable' using errcode = '42P01';
end if;

  -- 3. Anti-spam : max 5 orgs créées par user (toutes confondues)
select count(*) into v_owner_count
from public.organizations
where owner_user_id = v_user_id
  and deleted_at is null;
if v_owner_count >= 5 then
    raise exception 'Limite de 5 organisations atteinte par utilisateur'
      using errcode = '23514';
end if;

  -- 4. Normaliser et valider le slug
  v_normalized_slug := lower(trim(p_slug));
  if not public.is_valid_slug(v_normalized_slug) then
    raise exception 'Slug invalide (a-z, 0-9, tirets, 2-100 caractères)'
      using errcode = '23514';
end if;

  -- 5. Validation des inputs (le CHECK des tables le fait aussi mais on remonte
  --    une erreur claire au client)
  if length(trim(p_name)) < 2 or length(trim(p_name)) > 200 then
    raise exception 'Le nom doit faire entre 2 et 200 caractères'
      using errcode = '23514';
end if;

  -- 6. Vérifier l'unicité du slug
  if exists (select 1 from public.organizations where slug = v_normalized_slug) then
    raise exception 'Ce slug est déjà utilisé'
      using errcode = '23505';
end if;

  -- 7. Créer l'organization (status FORCÉ à 'draft')
insert into public.organizations (
    org_type, slug, name, country, contact_email, contact_phone,
    status, owner_user_id
)
values (
           p_org_type,
           v_normalized_slug,
           trim(p_name),
           p_country,
           p_contact_email,
           p_contact_phone,
           'draft',
           v_user_id
       )
    returning id into v_org_id;

-- 8. Créer la ligne de détails (etang_details OU magasin_details)
if p_org_type = 'etang' then
    insert into public.etang_details (organization_id) values (v_org_id);
else
    insert into public.magasin_details (organization_id) values (v_org_id);
end if;

  -- 9. Créer le membership owner (auto-accepté)
insert into public.memberships (
    organization_id, user_id, role, accepted_at
)
values (v_org_id, v_user_id, 'owner', now());

-- 10. Audit log
insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'organization.create',
           'organization',
           v_org_id,
           jsonb_build_object('org_type', p_org_type, 'slug', v_normalized_slug)
       );

-- Retour
return query select v_org_id, v_normalized_slug;
end;
$$;

revoke execute on function public.create_organization_for_owner(
    org_type, text, text, country_code, text, text
    ) from public;

grant execute on function public.create_organization_for_owner(
  org_type, text, text, country_code, text, text
) to authenticated;

comment on function public.create_organization_for_owner is
  'Crée une org + membership owner en transaction. Appelée après auth.signUp.';