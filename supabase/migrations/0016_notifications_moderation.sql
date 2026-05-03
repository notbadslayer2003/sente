-- =============================================================================
-- Sente — Phase 6.4 : notifications in-app + modération
-- (adapté au schema reports polymorphe : target_type + target_id + detail)
-- =============================================================================

-- 1. Enum notification_type
do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
create type notification_type as enum (
      'comment_on_post',
      'reply_to_comment',
      'org_mentioned',
      'new_follower',
      'post_hidden_by_admin',
      'comment_hidden',
      'account_action'
    );
end if;
end$$;

-- 2. Table notifications
create table if not exists public.notifications (
                                                    id              uuid primary key default gen_random_uuid(),
    recipient_user_id uuid not null references public.profiles(id) on delete cascade,
    type            notification_type not null,
    actor_user_id   uuid references public.profiles(id) on delete set null,
    actor_org_id    uuid references public.organizations(id) on delete set null,
    target_post_id    uuid references public.posts(id) on delete cascade,
    target_comment_id uuid references public.post_comments(id) on delete cascade,
    target_org_id     uuid references public.organizations(id) on delete cascade,
    payload         jsonb not null default '{}'::jsonb,
    read_at         timestamptz,
    created_at      timestamptz not null default now()
    );

create index if not exists idx_notifications_recipient_unread
    on public.notifications(recipient_user_id, created_at desc)
    where read_at is null;

create index if not exists idx_notifications_recipient_all
    on public.notifications(recipient_user_id, created_at desc);

-- 3. RLS notifications
alter table public.notifications enable row level security;
alter table public.notifications force row level security;

create policy "notifications read own" on public.notifications
  for select to authenticated
                 using (recipient_user_id = auth.uid());

create policy "notifications update own" on public.notifications
  for update to authenticated
                 using (recipient_user_id = auth.uid())
      with check (recipient_user_id = auth.uid());

create policy "notifications insert system" on public.notifications
  for insert to authenticated
  with check (false);

create policy "notifications admin all" on public.notifications
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- 4. Helper SECURITY DEFINER pour insérer une notif
create or replace function public.fn_notify(
  p_recipient_user_id uuid,
  p_type             notification_type,
  p_actor_user_id    uuid default null,
  p_actor_org_id     uuid default null,
  p_target_post_id   uuid default null,
  p_target_comment_id uuid default null,
  p_target_org_id    uuid default null,
  p_payload          jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_recipient_user_id is null then return; end if;
  if p_actor_user_id is not null and p_actor_user_id = p_recipient_user_id then return; end if;

insert into public.notifications (
    recipient_user_id, type,
    actor_user_id, actor_org_id,
    target_post_id, target_comment_id, target_org_id,
    payload
)
values (
           p_recipient_user_id, p_type,
           p_actor_user_id, p_actor_org_id,
           p_target_post_id, p_target_comment_id, p_target_org_id,
           coalesce(p_payload, '{}'::jsonb)
       );
end;
$$;

-- 5. Trigger : notif sur commentaire
create or replace function public.tg_notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_post_author     uuid;
  v_parent_author   uuid;
begin
select author_user_id into v_post_author
from public.posts where id = new.post_id;

if v_post_author is not null then
    perform public.fn_notify(
      p_recipient_user_id := v_post_author,
      p_type := 'comment_on_post',
      p_actor_user_id := new.author_user_id,
      p_target_post_id := new.post_id,
      p_target_comment_id := new.id
    );
end if;

  if new.parent_id is not null then
select author_user_id into v_parent_author
from public.post_comments where id = new.parent_id;

if v_parent_author is not null and v_parent_author <> v_post_author then
      perform public.fn_notify(
        p_recipient_user_id := v_parent_author,
        p_type := 'reply_to_comment',
        p_actor_user_id := new.author_user_id,
        p_target_post_id := new.post_id,
        p_target_comment_id := new.id
      );
end if;
end if;

return new;
end;
$$;

create trigger trg_notify_on_comment
    after insert on public.post_comments
    for each row execute function public.tg_notify_on_comment();

-- 6. Trigger : notif sur mention d'org
create or replace function public.tg_notify_on_mention()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_actor_user_id uuid;
  m record;
begin
select author_user_id into v_actor_user_id
from public.posts where id = new.post_id;

for m in
select user_id from public.memberships
where organization_id = new.organization_id
  and accepted_at is not null
  and role in ('owner','admin')
  and revoked_at is null
    loop
    perform public.fn_notify(
      p_recipient_user_id := m.user_id,
      p_type := 'org_mentioned',
      p_actor_user_id := v_actor_user_id,
      p_target_post_id := new.post_id,
      p_target_org_id := new.organization_id
    );
end loop;

return new;
end;
$$;

create trigger trg_notify_on_mention
    after insert on public.post_org_mentions
    for each row execute function public.tg_notify_on_mention();

-- 7. Trigger : notif sur nouveau follower
create or replace function public.tg_notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
m record;
begin
for m in
select user_id from public.memberships
where organization_id = new.target_org_id
  and accepted_at is not null
  and role in ('owner','admin')
  and revoked_at is null
    loop
    perform public.fn_notify(
      p_recipient_user_id := m.user_id,
      p_type := 'new_follower',
      p_actor_user_id := new.follower_user_id,
      p_target_org_id := new.target_org_id
    );
end loop;

return new;
end;
$$;

create trigger trg_notify_on_follow
    after insert on public.follows
    for each row execute function public.tg_notify_on_follow();

-- 8. RPC : marquer une notif comme lue
create or replace function public.mark_notification_read(
  p_notification_id uuid
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

update public.notifications
set read_at = now()
where id = p_notification_id
  and recipient_user_id = v_user_id
  and read_at is null;
end;
$$;
revoke execute on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

-- 9. RPC : tout marquer comme lu
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

update public.notifications
set read_at = now()
where recipient_user_id = v_user_id
  and read_at is null;

get diagnostics v_count = row_count;
return v_count;
end;
$$;
revoke execute on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- =============================================================================
-- MODÉRATION : reports (schema polymorphe target_type + target_id)
-- =============================================================================

-- 10. Index sur reports pending
create index if not exists idx_reports_pending
    on public.reports(created_at desc)
    where status = 'pending';

-- 11. Unique : un user ne peut signaler qu'une fois la même cible
create unique index if not exists uniq_reports_target_per_user
    on public.reports(reporter_user_id, target_type, target_id);

-- 12. RLS reports
alter table public.reports enable row level security;
alter table public.reports force row level security;

create policy "reports insert authed" on public.reports
  for insert to authenticated
  with check (
    reporter_user_id = auth.uid()
    and target_type in ('post', 'comment')
  );

create policy "reports read own" on public.reports
  for select to authenticated
                        using (reporter_user_id = auth.uid());

create policy "reports admin all" on public.reports
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- 13. RPC : créer un signalement
create or replace function public.create_report(
  p_target_type   text,
  p_target_id     uuid,
  p_reason_code   text,
  p_detail        text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_report_id uuid;
  v_target_exists boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  if p_target_type not in ('post', 'comment') then
    raise exception 'Type de cible invalide' using errcode = '23514';
end if;

  if p_reason_code is null or p_reason_code not in ('spam','harassment','inappropriate','misinfo','other') then
    raise exception 'Raison invalide' using errcode = '23514';
end if;

  if p_detail is not null and length(p_detail) > 1000 then
    raise exception 'Détail trop long (max 1000 chars)' using errcode = '23514';
end if;

  -- Vérifie que la cible existe
  if p_target_type = 'post' then
select exists(select 1 from public.posts where id = p_target_id and deleted_at is null) into v_target_exists;
else
select exists(select 1 from public.post_comments where id = p_target_id and deleted_at is null) into v_target_exists;
end if;

  if not v_target_exists then
    raise exception 'Cible introuvable' using errcode = '42P01';
end if;

insert into public.reports (
    reporter_user_id,
    target_type, target_id,
    reason, detail
)
values (
           v_user_id,
           p_target_type::report_target, p_target_id,
           p_reason_code, nullif(trim(coalesce(p_detail, '')), '')
       )
    returning id into v_report_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'report.create',
           p_target_type,
           p_target_id,
           jsonb_build_object('reason', p_reason_code)
       );

return v_report_id;
exception
  when unique_violation then
    raise exception 'Tu as déjà signalé ce contenu' using errcode = '23505';
end;
$$;
revoke execute on function public.create_report(text, uuid, text, text) from public;
grant execute on function public.create_report(text, uuid, text, text) to authenticated;

-- 14. RPC admin : ignorer un report
create or replace function public.dismiss_report(
  p_report_id uuid,
  p_note text
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
  if v_user_id is null or not public.is_app_admin() then
    raise exception 'Accès admin requis' using errcode = '42501';
end if;

update public.reports
set status = 'dismissed',
    resolved_at = now(),
    resolved_by = v_user_id,
    resolution_note = nullif(trim(coalesce(p_note, '')), '')
where id = p_report_id and status = 'pending';

if not found then
    raise exception 'Report introuvable ou déjà traité' using errcode = '42P01';
end if;
end;
$$;
revoke execute on function public.dismiss_report(uuid, text) from public;
grant execute on function public.dismiss_report(uuid, text) to authenticated;

-- 15. RPC admin : masquer un post via un report
create or replace function public.action_report_hide_post(
  p_report_id uuid,
  p_note      text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_target_id uuid;
  v_target_type text;
  v_post_author uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null or not public.is_app_admin() then
    raise exception 'Accès admin requis' using errcode = '42501';
end if;

select target_id, target_type::text into v_target_id, v_target_type
from public.reports
where id = p_report_id and status = 'pending';

if v_target_id is null or v_target_type <> 'post' then
    raise exception 'Report introuvable, sans cible post, ou déjà traité' using errcode = '42P01';
end if;

update public.posts
set deleted_at = now(), status = 'removed'
where id = v_target_id and deleted_at is null
    returning author_user_id into v_post_author;

-- Tous les reports pending sur ce post deviennent resolved
update public.reports
set status = 'resolved',
    resolved_at = now(),
    resolved_by = v_user_id,
    resolution_note = nullif(trim(coalesce(p_note, '')), '')
where target_type = 'post' and target_id = v_target_id and status = 'pending';

if v_post_author is not null then
    perform public.fn_notify(
      p_recipient_user_id := v_post_author,
      p_type := 'post_hidden_by_admin',
      p_target_post_id := v_target_id,
      p_payload := jsonb_build_object('note', coalesce(p_note, ''))
    );
end if;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'admin.post.hide',
           'post',
           v_target_id,
           jsonb_build_object('report_id', p_report_id, 'note', p_note)
       );
end;
$$;
revoke execute on function public.action_report_hide_post(uuid, text) from public;
grant execute on function public.action_report_hide_post(uuid, text) to authenticated;

-- 16. RPC admin : masquer un commentaire
create or replace function public.action_report_hide_comment(
  p_report_id uuid,
  p_note      text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_target_id uuid;
  v_target_type text;
  v_comment_author uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null or not public.is_app_admin() then
    raise exception 'Accès admin requis' using errcode = '42501';
end if;

select target_id, target_type::text into v_target_id, v_target_type
from public.reports
where id = p_report_id and status = 'pending';

if v_target_id is null or v_target_type <> 'comment' then
    raise exception 'Report introuvable, sans cible comment, ou déjà traité' using errcode = '42P01';
end if;

update public.post_comments
set hidden_at = now(),
    hidden_by = v_user_id,
    updated_at = now()
where id = v_target_id and hidden_at is null
    returning author_user_id into v_comment_author;

update public.reports
set status = 'resolved',
    resolved_at = now(),
    resolved_by = v_user_id,
    resolution_note = nullif(trim(coalesce(p_note, '')), '')
where target_type = 'comment' and target_id = v_target_id and status = 'pending';

if v_comment_author is not null then
    perform public.fn_notify(
      p_recipient_user_id := v_comment_author,
      p_type := 'comment_hidden',
      p_target_comment_id := v_target_id,
      p_payload := jsonb_build_object('by_admin', true, 'note', coalesce(p_note, ''))
    );
end if;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'admin.comment.hide',
           'post_comment',
           v_target_id,
           jsonb_build_object('report_id', p_report_id, 'note', p_note)
       );
end;
$$;
revoke execute on function public.action_report_hide_comment(uuid, text) from public;
grant execute on function public.action_report_hide_comment(uuid, text) to authenticated;

-- 17. RPC admin : bannir un user
create or replace function public.action_report_ban_user(
  p_report_id uuid,
  p_note      text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_target_id uuid;
  v_target_type text;
  v_target_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null or not public.is_app_admin() then
    raise exception 'Accès admin requis' using errcode = '42501';
end if;

select target_id, target_type::text into v_target_id, v_target_type
from public.reports
where id = p_report_id and status = 'pending';

if v_target_id is null then
    raise exception 'Report introuvable ou déjà traité' using errcode = '42P01';
end if;

  if v_target_type = 'post' then
select author_user_id into v_target_user_id from public.posts where id = v_target_id;
elsif v_target_type = 'comment' then
select author_user_id into v_target_user_id from public.post_comments where id = v_target_id;
else
    raise exception 'Type de cible non bannisable' using errcode = '23514';
end if;

  if v_target_user_id is null then
    raise exception 'Auteur introuvable' using errcode = '42P01';
end if;
  if v_target_user_id = v_user_id then
    raise exception 'Tu ne peux pas te bannir toi-même' using errcode = '42501';
end if;

update public.profiles
set deleted_at = now(), status = 'banned'
where id = v_target_user_id;

update public.reports
set status = 'resolved',
    resolved_at = now(),
    resolved_by = v_user_id,
    resolution_note = nullif(trim(coalesce(p_note, '')), '')
where id = p_report_id;

perform public.fn_notify(
    p_recipient_user_id := v_target_user_id,
    p_type := 'account_action',
    p_payload := jsonb_build_object('action', 'banned', 'note', coalesce(p_note, ''))
  );

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'admin.user.ban',
           'profile',
           v_target_user_id,
           jsonb_build_object('report_id', p_report_id, 'note', p_note)
       );
end;
$$;
revoke execute on function public.action_report_ban_user(uuid, text) from public;
grant execute on function public.action_report_ban_user(uuid, text) to authenticated;