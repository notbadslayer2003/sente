-- =============================================================================
-- Sente — Phase 6 : posts enrichis + mentions orgs + compte officiel
-- =============================================================================

-- 1. Colonnes enrichies sur posts
alter table public.posts
    add column if not exists espece espece_poisson,
    add column if not exists weight_kg numeric(5,2)
    check (weight_kg is null or (weight_kg > 0 and weight_kg < 1000)),
    add column if not exists matos text
    check (matos is null or length(matos) <= 100);

comment on column public.posts.espece is 'Espèce de poisson liée au post (filtrage du fil).';
comment on column public.posts.weight_kg is 'Poids de la prise en kg (si applicable).';
comment on column public.posts.matos is 'Matériel utilisé en texte libre court.';

-- 2. Mentions d'orgs dans les posts (tag étang/magasin)
create table if not exists public.post_org_mentions (
                                                        post_id         uuid not null references public.posts(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    removed_at      timestamptz, -- l'org peut "retirer" sa mention
    removed_by      uuid references public.profiles(id),
    created_at      timestamptz not null default now(),
    primary key (post_id, organization_id)
    );
comment on table public.post_org_mentions is
  'Tags d''étangs/magasins dans un post pêcheur. Une org peut retirer une mention silencieusement.';

create index if not exists idx_post_mentions_org_active
    on public.post_org_mentions(organization_id, created_at desc)
    where removed_at is null;

-- 3. Compte Sente officiel : flag sur orgs
alter table public.organizations
    add column if not exists is_sente_official boolean not null default false;
comment on column public.organizations.is_sente_official is
  'Org marquée comme compte officiel Sente. Posts pinned en top du fil.';

-- 4. RLS sur post_org_mentions
alter table public.post_org_mentions enable row level security;
alter table public.post_org_mentions force row level security;

-- Lecture : tout le monde peut voir les mentions actives (publiques)
create policy "post_mentions read public" on public.post_org_mentions
  for select to anon, authenticated
                 using (removed_at is null);

-- Insertion : seul l'auteur du post peut tagger (via server action)
create policy "post_mentions insert author" on public.post_org_mentions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.author_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- Update (= retrait) : owner/admin de l'org mentionnée peut retirer sa mention
create policy "post_mentions update org" on public.post_org_mentions
  for update to authenticated
                        using (public.is_org_owner_or_admin(organization_id))
      with check (public.is_org_owner_or_admin(organization_id));

-- App admin a accès total
create policy "post_mentions admin all" on public.post_org_mentions
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- 5. RPC create_post : crée un post avec mentions optionnelles, atomique
create or replace function public.create_post(
  p_author_user_id   uuid,
  p_author_org_id    uuid,
  p_content          text,
  p_photos           text[],
  p_espece           espece_poisson,
  p_weight_kg        numeric,
  p_matos            text,
  p_mentioned_org_ids uuid[]
)
returns table (post_id uuid)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id   uuid;
  v_post_id   uuid;
  v_mention_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  -- XOR strict : soit author_user, soit author_org, jamais les deux
  if (p_author_user_id is not null and p_author_org_id is not null)
     or (p_author_user_id is null and p_author_org_id is null) then
    raise exception 'Auteur invalide : exactement un des author_user_id ou author_org_id'
      using errcode = '23514';
end if;

  -- Si user post : doit être l'auth.uid()
  if p_author_user_id is not null and p_author_user_id <> v_user_id then
    raise exception 'Tu ne peux pas poster au nom d''un autre user' using errcode = '42501';
end if;

  -- Si org post : doit être owner/admin/staff de l'org
  if p_author_org_id is not null and not public.is_org_member(p_author_org_id) then
    raise exception 'Tu ne peux pas poster au nom de cette organisation' using errcode = '42501';
end if;

  -- Validation contenu
  if p_content is null or length(trim(p_content)) < 1 or length(p_content) > 4000 then
    raise exception 'Contenu invalide (1-4000 caractères)' using errcode = '23514';
end if;

  if cardinality(coalesce(p_photos, '{}'::text[])) > 5 then
    raise exception 'Maximum 5 photos par post' using errcode = '23514';
end if;

  -- Crée le post
insert into public.posts (
    author_user_id, author_org_id, content, photos,
    espece, weight_kg, matos
)
values (
           p_author_user_id, p_author_org_id, p_content, coalesce(p_photos, '{}'::text[]),
           p_espece, p_weight_kg, nullif(trim(coalesce(p_matos, '')), '')
       )
    returning id into v_post_id;

-- Crée les mentions (si fournies, max 5)
if p_mentioned_org_ids is not null and cardinality(p_mentioned_org_ids) > 0 then
    if cardinality(p_mentioned_org_ids) > 5 then
      raise exception 'Maximum 5 mentions d''organisations par post' using errcode = '23514';
end if;

    -- Insert distinct (au cas où le client envoie des doublons)
insert into public.post_org_mentions (post_id, organization_id)
select v_post_id, distinct_org_id
from unnest(p_mentioned_org_ids) as distinct_org_id
    on conflict do nothing;
end if;

  -- Audit
insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'post.create',
           'post',
           v_post_id,
           jsonb_build_object(
                   'author_user_id', p_author_user_id,
                   'author_org_id', p_author_org_id,
                   'photos_count', cardinality(coalesce(p_photos, '{}'::text[])),
                   'mentions_count', cardinality(coalesce(p_mentioned_org_ids, '{}'::uuid[]))
           )
       );

return query select v_post_id;
end;
$$;
revoke execute on function public.create_post(uuid, uuid, text, text[], espece_poisson, numeric, text, uuid[]) from public;
grant execute on function public.create_post(uuid, uuid, text, text[], espece_poisson, numeric, text, uuid[]) to authenticated;

-- 6. RPC remove_org_mention : owner/admin retire silencieusement la mention de son org
create or replace function public.remove_org_mention(
  p_post_id         uuid,
  p_organization_id uuid
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

  if not public.is_org_owner_or_admin(p_organization_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

update public.post_org_mentions
set removed_at = now(),
    removed_by = v_user_id
where post_id = p_post_id
  and organization_id = p_organization_id
  and removed_at is null;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'post.mention.remove',
           'post',
           p_post_id,
           jsonb_build_object('organization_id', p_organization_id)
       );
end;
$$;
revoke execute on function public.remove_org_mention(uuid, uuid) from public;
grant execute on function public.remove_org_mention(uuid, uuid) to authenticated;