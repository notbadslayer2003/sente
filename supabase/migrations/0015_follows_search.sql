-- =============================================================================
-- Sente — Phase 6.3 : follows + recherche
-- =============================================================================

-- 1. RLS sur follows (table existe depuis 0001 mais on s'assure des policies)
alter table public.follows enable row level security;

drop policy if exists "follows read public" on public.follows;
create policy "follows read public" on public.follows
  for select to anon, authenticated using (true);

drop policy if exists "follows insert own" on public.follows;
create policy "follows insert own" on public.follows
  for insert to authenticated
  with check (
    follower_user_id = auth.uid() and
    exists (
      select 1 from public.organizations o
      where o.id = target_org_id
        and o.status = 'active'
        and o.deleted_at is null
    )
  );

drop policy if exists "follows delete own" on public.follows;
create policy "follows delete own" on public.follows
  for delete to authenticated
  using (follower_user_id = auth.uid());

-- App admin a accès total
drop policy if exists "follows admin all" on public.follows;
create policy "follows admin all" on public.follows
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- 2. Compteur followers_count sur organizations (pour afficher "X abonnés")
alter table public.organizations
    add column if not exists followers_count integer not null default 0
    check (followers_count >= 0);

-- 3. Trigger pour maintenir followers_count à jour
create or replace function public.tg_follows_count_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if (tg_op = 'INSERT') then
update public.organizations
set followers_count = followers_count + 1
where id = new.target_org_id;
return new;
elsif (tg_op = 'DELETE') then
update public.organizations
set followers_count = greatest(followers_count - 1, 0)
where id = old.target_org_id;
return old;
end if;
return null;
end;
$$;

drop trigger if exists trg_follows_count on public.follows;
create trigger trg_follows_count
    after insert or delete on public.follows
  for each row execute function public.tg_follows_count_update();

-- 4. Backfill du count (au cas où des follows existeraient déjà)
update public.organizations o
set followers_count = (
    select count(*) from public.follows f where f.target_org_id = o.id
);

-- 5. Index pour la recherche full-text simple sur orgs
-- On utilise un index trigram pour des LIKE/ILIKE rapides
create extension if not exists pg_trgm;

create index if not exists idx_orgs_name_trgm
    on public.organizations using gin (name gin_trgm_ops)
    where status = 'active' and deleted_at is null;

create index if not exists idx_orgs_city_trgm
    on public.organizations using gin (city gin_trgm_ops)
    where status = 'active' and deleted_at is null;