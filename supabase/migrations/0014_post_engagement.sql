-- =============================================================================
-- Sente — Phase 6.2 : engagement posts (likes, commentaires, masquage)
-- =============================================================================

-- 1. Édition + soft-delete commentaires
alter table public.post_comments
    add column if not exists edited_at timestamptz,
    add column if not exists hidden_at timestamptz,
    add column if not exists hidden_by uuid references public.profiles(id);

comment on column public.post_comments.edited_at is
  'Timestamp de la dernière édition. Affiché en UI avec mention "modifié".';
comment on column public.post_comments.hidden_at is
  'Timestamp de masquage par l''auteur du post (modération soft).';

-- 2. RLS sur post_comments
-- (La table existe depuis 0001 mais n'avait pas de policies activées correctement)
alter table public.post_comments enable row level security;

-- Lecture : tout le monde peut lire les commentaires non supprimés et non masqués
drop policy if exists "comments read public" on public.post_comments;
create policy "comments read public" on public.post_comments
  for select to anon, authenticated
                      using (deleted_at is null and hidden_at is null);

-- Lecture : l'auteur peut voir ses propres commentaires masqués (transparence)
drop policy if exists "comments read own hidden" on public.post_comments;
create policy "comments read own hidden" on public.post_comments
  for select to authenticated
                      using (author_user_id = auth.uid() and deleted_at is null);

-- Lecture : l'auteur du post peut voir les commentaires masqués sur son post
drop policy if exists "comments read post owner" on public.post_comments;
create policy "comments read post owner" on public.post_comments
  for select to authenticated
                      using (
                      deleted_at is null and exists (
                      select 1 from public.posts p
                      where p.id = post_id and p.author_user_id = auth.uid()
                      )
                      );

-- Insertion : tout user authentifié peut commenter sur un post visible
drop policy if exists "comments insert auth" on public.post_comments;
create policy "comments insert auth" on public.post_comments
  for insert to authenticated
  with check (
    author_user_id = auth.uid() and
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.status = 'published'
        and p.deleted_at is null
    )
  );

-- Update : seul l'auteur du commentaire peut éditer (et seulement le contenu)
drop policy if exists "comments update author" on public.post_comments;
create policy "comments update author" on public.post_comments
  for update to authenticated
                                  using (author_user_id = auth.uid() and deleted_at is null)
      with check (author_user_id = auth.uid());

-- App admin a accès total
drop policy if exists "comments admin all" on public.post_comments;
create policy "comments admin all" on public.post_comments
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- 3. RLS sur post_likes (existait déjà mais on s'assure)
alter table public.post_likes enable row level security;

drop policy if exists "post_likes read public" on public.post_likes;
create policy "post_likes read public" on public.post_likes
  for select to anon, authenticated using (true);

drop policy if exists "post_likes insert own" on public.post_likes;
create policy "post_likes insert own" on public.post_likes
  for insert to authenticated
  with check (
    user_id = auth.uid() and
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.status = 'published'
        and p.deleted_at is null
    )
  );

drop policy if exists "post_likes delete own" on public.post_likes;
create policy "post_likes delete own" on public.post_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- 4. Idem pour comment_likes
alter table public.comment_likes enable row level security;

drop policy if exists "comment_likes read public" on public.comment_likes;
create policy "comment_likes read public" on public.comment_likes
  for select to anon, authenticated using (true);

drop policy if exists "comment_likes insert own" on public.comment_likes;
create policy "comment_likes insert own" on public.comment_likes
  for insert to authenticated
  with check (
    user_id = auth.uid() and
    exists (
      select 1 from public.post_comments c
      where c.id = comment_id
        and c.deleted_at is null
        and c.hidden_at is null
    )
  );

drop policy if exists "comment_likes delete own" on public.comment_likes;
create policy "comment_likes delete own" on public.comment_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- 5. RPC : créer un commentaire (avec validation 2-niveaux max)
create or replace function public.create_post_comment(
  p_post_id    uuid,
  p_parent_id  uuid,
  p_content    text
)
returns table (comment_id uuid)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id    uuid;
  v_comment_id uuid;
  v_parent_grandparent uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  if p_content is null or length(trim(p_content)) < 1 or length(p_content) > 2000 then
    raise exception 'Commentaire invalide (1-2000 caractères)' using errcode = '23514';
end if;

  -- Vérifie que le post existe et est visible
  if not exists (
    select 1 from public.posts
    where id = p_post_id and status = 'published' and deleted_at is null
  ) then
    raise exception 'Post introuvable' using errcode = '42P01';
end if;

  -- Si parent_id : doit être un commentaire racine (max 2 niveaux)
  if p_parent_id is not null then
select parent_id into v_parent_grandparent
from public.post_comments
where id = p_parent_id and post_id = p_post_id
  and deleted_at is null and hidden_at is null;

if v_parent_grandparent is null and not exists (
      select 1 from public.post_comments where id = p_parent_id
    ) then
      raise exception 'Commentaire parent introuvable' using errcode = '42P01';
end if;

    -- Refuse si le parent a déjà un parent (donc on serait au niveau 3+)
    if v_parent_grandparent is not null then
      raise exception 'Maximum 2 niveaux de commentaires' using errcode = '23514';
end if;
end if;

insert into public.post_comments (post_id, parent_id, author_user_id, content)
values (p_post_id, p_parent_id, v_user_id, trim(p_content))
    returning id into v_comment_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'comment.create',
           'post_comment',
           v_comment_id,
           jsonb_build_object('post_id', p_post_id, 'parent_id', p_parent_id)
       );

return query select v_comment_id;
end;
$$;
revoke execute on function public.create_post_comment(uuid, uuid, text) from public;
grant execute on function public.create_post_comment(uuid, uuid, text) to authenticated;

-- 6. RPC : éditer un commentaire
create or replace function public.update_post_comment(
  p_comment_id uuid,
  p_content    text
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

  if p_content is null or length(trim(p_content)) < 1 or length(p_content) > 2000 then
    raise exception 'Commentaire invalide (1-2000 caractères)' using errcode = '23514';
end if;

update public.post_comments
set content = trim(p_content),
    edited_at = now(),
    updated_at = now()
where id = p_comment_id
  and author_user_id = v_user_id
  and deleted_at is null;

if not found then
    raise exception 'Commentaire introuvable ou non autorisé' using errcode = '42501';
end if;
end;
$$;
revoke execute on function public.update_post_comment(uuid, text) from public;
grant execute on function public.update_post_comment(uuid, text) to authenticated;

-- 7. RPC : masquer un commentaire (par l'auteur du post)
create or replace function public.hide_post_comment(
  p_comment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id  uuid;
  v_post_id  uuid;
  v_post_author uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

select c.post_id, p.author_user_id
into v_post_id, v_post_author
from public.post_comments c
         join public.posts p on p.id = c.post_id
where c.id = p_comment_id;

if v_post_id is null then
    raise exception 'Commentaire introuvable' using errcode = '42P01';
end if;

  if v_post_author is null or v_post_author <> v_user_id then
    raise exception 'Seul l''auteur du post peut masquer un commentaire' using errcode = '42501';
end if;

update public.post_comments
set hidden_at = now(),
    hidden_by = v_user_id,
    updated_at = now()
where id = p_comment_id
  and hidden_at is null;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'comment.hide',
           'post_comment',
           p_comment_id,
           jsonb_build_object('post_id', v_post_id)
       );
end;
$$;
revoke execute on function public.hide_post_comment(uuid) from public;
grant execute on function public.hide_post_comment(uuid) to authenticated;