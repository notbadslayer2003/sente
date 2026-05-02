-- =============================================================================
-- Sente — RPCs pour les invitations multi-user
-- =============================================================================
-- Hash SHA256 du token côté serveur, jamais le clair en DB.
-- Les invitations expirent après 14 jours, max 10 tentatives par token.
-- =============================================================================

-- 1. Créer une invitation (par owner/admin de l'org)
-- -----------------------------------------------------------------------------
create or replace function public.create_invitation(
  p_org_id     uuid,
  p_email      text,
  p_role       member_role,
  p_token_hash text
)
returns table (invitation_id uuid)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_inv_id  uuid;
  v_normalized_email citext;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  -- L'appelant doit être owner/admin de l'org
  if not public.is_org_owner_or_admin(p_org_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

  -- Validation email basique (le CHECK de la table validera plus loin)
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'Email requis' using errcode = '23514';
end if;

  v_normalized_email := lower(trim(p_email))::citext;

  -- L'owner ne peut inviter que admin ou staff (pas un autre owner)
  if p_role = 'owner' then
    raise exception 'Impossible d''inviter un nouvel owner. Transfère la propriété depuis les paramètres.'
      using errcode = '23514';
end if;

  -- Empêche d'inviter un email qui est déjà membre actif de l'org
  if exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_org_id
      and p.email = v_normalized_email
      and m.accepted_at is not null
  ) then
    raise exception 'Cette personne est déjà membre de l''organisation'
      using errcode = '23505';
end if;

  -- Empêche d'avoir 2 invitations actives pour le même email/org
  if exists (
    select 1 from public.invitations
    where organization_id = p_org_id
      and email = v_normalized_email
      and accepted_at is null
      and revoked_at is null
      and expires_at > now()
  ) then
    raise exception 'Une invitation est déjà en attente pour cet email'
      using errcode = '23505';
end if;

  -- Validation du hash : SHA256 hex = 64 chars
  if p_token_hash is null or length(p_token_hash) <> 64 then
    raise exception 'Token hash invalide' using errcode = '23514';
end if;

  -- Création
insert into public.invitations (
    organization_id, email, role, token_hash, invited_by, expires_at
)
values (
           p_org_id,
           v_normalized_email,
           p_role,
           p_token_hash,
           v_user_id,
           now() + interval '14 days'
       )
    returning id into v_inv_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'invitation.create',
           'organization',
           p_org_id,
           jsonb_build_object('email', v_normalized_email, 'role', p_role)
       );

return query select v_inv_id;
end;
$$;
revoke execute on function public.create_invitation(uuid, text, member_role, text) from public;
grant execute on function public.create_invitation(uuid, text, member_role, text) to authenticated;

-- 2. Accepter une invitation (par l'invité, après login)
-- -----------------------------------------------------------------------------
create or replace function public.accept_invitation(
  p_token_hash text
)
returns table (
  organization_id   uuid,
  organization_slug text,
  organization_name text,
  member_role       member_role
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id  uuid;
  v_user_email citext;
  v_inv      record;
  v_org      record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  -- Récupère l'email du user pour valider que l'invité est le bon
select email into v_user_email
from public.profiles where id = v_user_id;
if v_user_email is null then
    raise exception 'Profil introuvable' using errcode = '42P01';
end if;

  -- Validation hash
  if p_token_hash is null or length(p_token_hash) <> 64 then
    raise exception 'Token invalide' using errcode = '23514';
end if;

  -- Récupère l'invitation matching, encore active
select id, organization_id, email, role, expires_at, accepted_at, revoked_at, attempts
into v_inv
from public.invitations
where token_hash = p_token_hash
    for update;

if not found then
    raise exception 'Invitation introuvable' using errcode = '42P01';
end if;

  -- Incrémente le compteur de tentatives même si elle échoue
update public.invitations
set attempts = attempts + 1
where id = v_inv.id;

if v_inv.attempts >= 10 then
    raise exception 'Trop de tentatives sur cette invitation' using errcode = '42501';
end if;

  if v_inv.accepted_at is not null then
    raise exception 'Cette invitation a déjà été utilisée' using errcode = '23505';
end if;

  if v_inv.revoked_at is not null then
    raise exception 'Cette invitation a été révoquée' using errcode = '42501';
end if;

  if v_inv.expires_at < now() then
    raise exception 'Cette invitation a expiré' using errcode = '42501';
end if;

  if v_inv.email <> v_user_email then
    raise exception 'Cette invitation est destinée à un autre email'
      using errcode = '42501';
end if;

  -- Récupère l'org
select id, slug, name into v_org
from public.organizations
where id = v_inv.organization_id and deleted_at is null;
if not found then
    raise exception 'Organisation introuvable ou supprimée' using errcode = '42P01';
end if;

  -- Crée le membership (idempotent : si existe déjà, on update accepted_at)
insert into public.memberships (
    organization_id, user_id, role, invited_by, accepted_at
)
values (v_inv.organization_id, v_user_id, v_inv.role, null, now())
    on conflict (organization_id, user_id) do update
                                                  set role = excluded.role,
                                                  accepted_at = coalesce(public.memberships.accepted_at, now()),
                                                  updated_at = now();

-- Marque l'invitation comme acceptée
update public.invitations
set accepted_at = now()
where id = v_inv.id;

-- Audit
insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'invitation.accept',
           'organization',
           v_inv.organization_id,
           jsonb_build_object('role', v_inv.role)
       );

return query select v_org.id, v_org.slug, v_org.name, v_inv.role;
end;
$$;
revoke execute on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

-- 3. Révoquer une invitation (par owner/admin)
-- -----------------------------------------------------------------------------
create or replace function public.revoke_invitation(
  p_invitation_id uuid
)
returns table (invitation_id uuid)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_inv     record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

select id, organization_id, accepted_at, revoked_at
into v_inv
from public.invitations
where id = p_invitation_id;

if not found then
    raise exception 'Invitation introuvable' using errcode = '42P01';
end if;

  if not public.is_org_owner_or_admin(v_inv.organization_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

  if v_inv.accepted_at is not null then
    raise exception 'Cette invitation a déjà été acceptée' using errcode = '23505';
end if;

  if v_inv.revoked_at is not null then
    raise exception 'Cette invitation est déjà révoquée' using errcode = '23505';
end if;

update public.invitations
set revoked_at = now()
where id = p_invitation_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'invitation.revoke',
           'organization',
           v_inv.organization_id,
           jsonb_build_object('invitation_id', p_invitation_id)
       );

return query select p_invitation_id;
end;
$$;
revoke execute on function public.revoke_invitation(uuid) from public;
grant execute on function public.revoke_invitation(uuid) to authenticated;

-- 4. Retirer un membre (par owner/admin, sauf l'owner unique)
-- -----------------------------------------------------------------------------
create or replace function public.remove_member(
  p_membership_id uuid
)
returns table (membership_id uuid)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id  uuid;
  v_member   record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

select id, organization_id, user_id, role
into v_member
from public.memberships
where id = p_membership_id;

if not found then
    raise exception 'Membre introuvable' using errcode = '42P01';
end if;

  if not public.is_org_owner_or_admin(v_member.organization_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

  -- L'owner ne peut pas être retiré (transfert de propriété requis)
  if v_member.role = 'owner' then
    raise exception 'L''owner ne peut pas être retiré. Transfère la propriété d''abord.'
      using errcode = '23514';
end if;

delete from public.memberships where id = p_membership_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'membership.remove',
           'organization',
           v_member.organization_id,
           jsonb_build_object('removed_user_id', v_member.user_id, 'role', v_member.role)
       );

return query select p_membership_id;
end;
$$;
revoke execute on function public.remove_member(uuid) from public;
grant execute on function public.remove_member(uuid) to authenticated;