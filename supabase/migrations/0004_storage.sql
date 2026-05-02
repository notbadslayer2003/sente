-- =============================================================================
-- Sente — Storage buckets et policies
-- =============================================================================
-- 2 buckets publics en lecture, écriture restreinte :
--   - org-photos : cover + galerie des étangs/magasins (write par membre)
--   - user-avatars : avatars des profils (write par self)
-- =============================================================================

-- 1. Création des buckets
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    ('org-photos', 'org-photos', true, 5242880,
     array['image/jpeg', 'image/png', 'image/webp']),
    ('user-avatars', 'user-avatars', true, 2097152,
     array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set
                            public = excluded.public,
                            file_size_limit = excluded.file_size_limit,
                            allowed_mime_types = excluded.allowed_mime_types;

-- Note : 5 Mo cover/galerie, 2 Mo avatar. La compression côté client maintient
-- des tailles bien plus basses, ces limites sont des garde-fous.

-- 2. Policies — org-photos
-- -----------------------------------------------------------------------------
-- Convention de path : org-photos/{org_id}/cover.jpg
--                      org-photos/{org_id}/gallery/{uuid}.jpg

-- Lecture publique
create policy "org_photos public read"
  on storage.objects for select
                                    to anon, authenticated
                                    using (bucket_id = 'org-photos');

-- Écriture : membre de l'org dont l'id est le 1er segment du path
create policy "org_photos write by member"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'org-photos'
    and is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "org_photos update by member"
  on storage.objects for update
                                           to authenticated
                                           using (
                                           bucket_id = 'org-photos'
                                           and is_org_member(((storage.foldername(name))[1])::uuid)
                                           )
                         with check (
                                           bucket_id = 'org-photos'
                                           and is_org_member(((storage.foldername(name))[1])::uuid)
                                           );

create policy "org_photos delete by member"
  on storage.objects for delete
to authenticated
  using (
    bucket_id = 'org-photos'
    and is_org_member(((storage.foldername(name))[1])::uuid)
  );

-- 3. Policies — user-avatars
-- -----------------------------------------------------------------------------
-- Convention de path : user-avatars/{user_id}/avatar.jpg

create policy "user_avatars public read"
  on storage.objects for select
                                    to anon, authenticated
                                    using (bucket_id = 'user-avatars');

create policy "user_avatars write self"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'user-avatars'
    and ((storage.foldername(name))[1])::uuid = auth.uid()
  );

create policy "user_avatars update self"
  on storage.objects for update
                                           to authenticated
                                           using (
                                           bucket_id = 'user-avatars'
                                           and ((storage.foldername(name))[1])::uuid = auth.uid()
                                           )
                         with check (
                                           bucket_id = 'user-avatars'
                                           and ((storage.foldername(name))[1])::uuid = auth.uid()
                                           );

create policy "user_avatars delete self"
  on storage.objects for delete
to authenticated
  using (
    bucket_id = 'user-avatars'
    and ((storage.foldername(name))[1])::uuid = auth.uid()
  );