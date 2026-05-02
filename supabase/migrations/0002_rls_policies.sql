-- =============================================================================
-- Sente — RLS policies (v2, deny-by-default strict)
-- =============================================================================
-- Approche : deny-by-default. Aucun USING (true) sans justification.
-- Roles Postgres :
--   anon          : visiteur public, accès très limité
--   authenticated : utilisateur connecté
--   service_role  : edge functions / webhooks (bypass RLS)
--
-- Helpers (cf. 0001) :
--   is_app_admin()
--   is_org_member(org)
--   is_org_owner_or_admin(org)
-- =============================================================================

-- 1. Activer RLS partout
-- -----------------------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.app_admins              enable row level security;
alter table public.organizations           enable row level security;
alter table public.memberships             enable row level security;
alter table public.invitations             enable row level security;
alter table public.etang_details           enable row level security;
alter table public.magasin_details         enable row level security;
alter table public.postes                  enable row level security;
alter table public.pecheur_subscriptions   enable row level security;
alter table public.posts                   enable row level security;
alter table public.post_likes              enable row level security;
alter table public.post_comments           enable row level security;
alter table public.comment_likes           enable row level security;
alter table public.follows                 enable row level security;
alter table public.reports                 enable row level security;
alter table public.events                  enable row level security;
alter table public.event_registrations     enable row level security;
alter table public.products                enable row level security;
alter table public.product_variants        enable row level security;
alter table public.orders                  enable row level security;
alter table public.order_items             enable row level security;
alter table public.payments                enable row level security;
alter table public.webhook_events          enable row level security;
alter table public.consent_log             enable row level security;
alter table public.audit_log               enable row level security;
alter table public.feature_flags           enable row level security;

-- Force RLS même pour les owners de table (sauf service_role)
alter table public.payments                force row level security;
alter table public.orders                  force row level security;
alter table public.audit_log               force row level security;
alter table public.webhook_events          force row level security;

-- 2. profiles
-- -----------------------------------------------------------------------------
-- Lecture publique limitée (le client filtrera les colonnes sensibles via une view si besoin)
create policy "profiles read public not deleted" on public.profiles
  for select to anon, authenticated
  using (deleted_at is null);

create policy "profiles self update" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- L'utilisateur ne peut PAS s'auto-supprimer (passe par une edge function pour soft delete propre)
-- L'app_admin peut tout faire
create policy "profiles admin all" on public.profiles
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

-- 3. app_admins (lecture admin uniquement)
-- -----------------------------------------------------------------------------
create policy "app_admins read self or admin" on public.app_admins
  for select to authenticated
  using (user_id = auth.uid() or is_app_admin());

create policy "app_admins write admin only" on public.app_admins
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

-- 4. organizations
-- -----------------------------------------------------------------------------
-- Lecture publique : seulement les orgs actives non supprimées
create policy "orgs read public active" on public.organizations
  for select to anon, authenticated
  using (status = 'active' and deleted_at is null);

-- Lecture étendue pour les members (toute statut, hors supprimé)
create policy "orgs read members all status" on public.organizations
  for select to authenticated
  using (
    deleted_at is null
    and (is_org_member(id) or owner_user_id = auth.uid())
  );

-- Création : tout user authentifié peut créer, mais l'owner doit être lui-même
create policy "orgs create authenticated as self" on public.organizations
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and status = 'draft'  -- on force draft à la création, l'admin Sente passe à active
  );

-- Update : owner ou admin de l'org. Pas le droit de changer status soi-même (sauf admin Sente)
create policy "orgs update by owner_admin" on public.organizations
  for update to authenticated
  using (
    deleted_at is null
    and (is_org_owner_or_admin(id) or owner_user_id = auth.uid())
  )
  with check (
    is_org_owner_or_admin(id) or owner_user_id = auth.uid()
  );

-- Tout pouvoir admin Sente
create policy "orgs admin all" on public.organizations
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

-- 5. memberships
-- -----------------------------------------------------------------------------
create policy "memberships read self or org_admin" on public.memberships
  for select to authenticated
  using (user_id = auth.uid() or is_org_owner_or_admin(organization_id));

-- Création directe : admin de l'org. Sinon passe par accept_invitation (service_role).
create policy "memberships insert by org_admin" on public.memberships
  for insert to authenticated
  with check (is_org_owner_or_admin(organization_id));

-- Update : admin de l'org ou self (pour accepter une invitation)
create policy "memberships update by org_admin or self_accept" on public.memberships
  for update to authenticated
  using (is_org_owner_or_admin(organization_id) or user_id = auth.uid())
  with check (is_org_owner_or_admin(organization_id) or user_id = auth.uid());

-- Suppression : admin de l'org uniquement
create policy "memberships delete by org_admin" on public.memberships
  for delete to authenticated
  using (is_org_owner_or_admin(organization_id));

create policy "memberships admin all" on public.memberships
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

-- 6. invitations
-- -----------------------------------------------------------------------------
-- L'invité ne lit jamais l'invitation directement : il passe par accept_invitation (service_role).
-- Seul l'org_admin gère ses invitations.
create policy "invitations read org_admin" on public.invitations
  for select to authenticated
  using (is_org_owner_or_admin(organization_id));

create policy "invitations write org_admin" on public.invitations
  for all to authenticated
  using (is_org_owner_or_admin(organization_id))
  with check (is_org_owner_or_admin(organization_id));

create policy "invitations admin all" on public.invitations
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

-- 7. etang_details / magasin_details
-- -----------------------------------------------------------------------------
create policy "etang_details read with active org" on public.etang_details
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.organizations o
      where o.id = etang_details.organization_id
        and o.status = 'active' and o.deleted_at is null
    )
    or is_org_member(organization_id)
    or is_app_admin()
  );

create policy "etang_details write by org_admin" on public.etang_details
  for all to authenticated
  using (is_org_owner_or_admin(organization_id))
  with check (is_org_owner_or_admin(organization_id));

create policy "etang_details admin all" on public.etang_details
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

create policy "magasin_details read with active org" on public.magasin_details
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.organizations o
      where o.id = magasin_details.organization_id
        and o.status = 'active' and o.deleted_at is null
    )
    or is_org_member(organization_id)
    or is_app_admin()
  );

create policy "magasin_details write by org_admin" on public.magasin_details
  for all to authenticated
  using (is_org_owner_or_admin(organization_id))
  with check (is_org_owner_or_admin(organization_id));

create policy "magasin_details admin all" on public.magasin_details
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

-- 8. postes
-- -----------------------------------------------------------------------------
create policy "postes read with active org" on public.postes
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.organizations o
      where o.id = postes.etang_id
        and o.status = 'active' and o.deleted_at is null
    )
    or is_org_member(etang_id)
  );

create policy "postes write by org_admin" on public.postes
  for all to authenticated
  using (is_org_owner_or_admin(etang_id))
  with check (is_org_owner_or_admin(etang_id));

-- 9. pecheur_subscriptions (CRM étang — privé)
-- -----------------------------------------------------------------------------
create policy "pecheur_subs read members or self" on public.pecheur_subscriptions
  for select to authenticated
  using (
    is_org_member(etang_id) or pecheur_user_id = auth.uid()
  );

create policy "pecheur_subs insert by org_staff" on public.pecheur_subscriptions
  for insert to authenticated
  with check (is_org_member(etang_id) and created_by_user_id = auth.uid());

create policy "pecheur_subs update by org_staff" on public.pecheur_subscriptions
  for update to authenticated
  using (is_org_member(etang_id))
  with check (is_org_member(etang_id));

create policy "pecheur_subs delete by org_admin" on public.pecheur_subscriptions
  for delete to authenticated
  using (is_org_owner_or_admin(etang_id));

create policy "pecheur_subs admin all" on public.pecheur_subscriptions
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

-- 10. posts
-- -----------------------------------------------------------------------------
create policy "posts read published" on public.posts
  for select to anon, authenticated
  using (status = 'published' and deleted_at is null);

create policy "posts read own" on public.posts
  for select to authenticated
  using (
    author_user_id = auth.uid()
    or (author_org_id is not null and is_org_member(author_org_id))
  );

create policy "posts insert as user or org_member" on public.posts
  for insert to authenticated
  with check (
    (author_user_id = auth.uid() and author_org_id is null)
    or (author_org_id is not null and author_user_id is null and is_org_member(author_org_id))
  );

create policy "posts update own" on public.posts
  for update to authenticated
  using (
    author_user_id = auth.uid()
    or (author_org_id is not null and is_org_member(author_org_id))
  )
  with check (
    author_user_id = auth.uid()
    or (author_org_id is not null and is_org_member(author_org_id))
  );

create policy "posts delete own" on public.posts
  for delete to authenticated
  using (
    author_user_id = auth.uid()
    or (author_org_id is not null and is_org_owner_or_admin(author_org_id))
  );

create policy "posts admin all" on public.posts
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

-- 11. post_likes & comment_likes
-- -----------------------------------------------------------------------------
create policy "post_likes read authenticated" on public.post_likes
  for select to authenticated using (true);

create policy "post_likes insert self" on public.post_likes
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "post_likes delete self" on public.post_likes
  for delete to authenticated
  using (user_id = auth.uid());

create policy "comment_likes read authenticated" on public.comment_likes
  for select to authenticated using (true);

create policy "comment_likes insert self" on public.comment_likes
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "comment_likes delete self" on public.comment_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- 12. post_comments
-- -----------------------------------------------------------------------------
create policy "comments read with published post" on public.post_comments
  for select to anon, authenticated
  using (
    status = 'published' and deleted_at is null
    and exists (
      select 1 from public.posts p
      where p.id = post_comments.post_id
        and p.status = 'published' and p.deleted_at is null
    )
  );

create policy "comments insert authenticated" on public.post_comments
  for insert to authenticated
  with check (author_user_id = auth.uid());

create policy "comments update self" on public.post_comments
  for update to authenticated
  using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid());

create policy "comments delete self_or_post_owner" on public.post_comments
  for delete to authenticated
  using (
    author_user_id = auth.uid()
    or exists (
      select 1 from public.posts p
      where p.id = post_comments.post_id
        and (p.author_user_id = auth.uid()
             or (p.author_org_id is not null and is_org_owner_or_admin(p.author_org_id)))
    )
  );

create policy "comments admin all" on public.post_comments
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

-- 13. follows
-- -----------------------------------------------------------------------------
create policy "follows read authenticated" on public.follows
  for select to authenticated using (true);

create policy "follows insert self" on public.follows
  for insert to authenticated
  with check (follower_user_id = auth.uid());

create policy "follows delete self" on public.follows
  for delete to authenticated
  using (follower_user_id = auth.uid());

-- 14. reports
-- -----------------------------------------------------------------------------
create policy "reports insert authenticated" on public.reports
  for insert to authenticated
  with check (reporter_user_id = auth.uid());

create policy "reports read self_or_admin" on public.reports
  for select to authenticated
  using (reporter_user_id = auth.uid() or is_app_admin());

create policy "reports update admin" on public.reports
  for update to authenticated
  using (is_app_admin())
  with check (is_app_admin());

-- 15. events & registrations
-- -----------------------------------------------------------------------------
create policy "events read published" on public.events
  for select to anon, authenticated
  using (status = 'published');

create policy "events read members all" on public.events
  for select to authenticated
  using (is_org_member(organization_id));

create policy "events write by org_member" on public.events
  for all to authenticated
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

create policy "events admin all" on public.events
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

create policy "event_regs read self_or_org" on public.event_registrations
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_registrations.event_id and is_org_member(e.organization_id)
    )
  );

create policy "event_regs insert authenticated" on public.event_registrations
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

create policy "event_regs update by org" on public.event_registrations
  for update to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_registrations.event_id and is_org_member(e.organization_id)
    )
  );

-- 16. products & variants
-- -----------------------------------------------------------------------------
create policy "products read active" on public.products
  for select to anon, authenticated
  using (status = 'active' and deleted_at is null);

create policy "products read members all" on public.products
  for select to authenticated
  using (is_org_member(magasin_id));

create policy "products write by org_member" on public.products
  for all to authenticated
  using (is_org_member(magasin_id))
  with check (is_org_member(magasin_id));

create policy "products admin all" on public.products
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

create policy "variants read with product" on public.product_variants
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.status = 'active' and p.deleted_at is null
    )
  );

create policy "variants write by magasin_member" on public.product_variants
  for all to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and is_org_member(p.magasin_id)
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and is_org_member(p.magasin_id)
    )
  );

-- 17. orders & order_items
-- -----------------------------------------------------------------------------
-- Aucun INSERT/UPDATE direct depuis le client : passe par edge function (service_role).
create policy "orders read buyer_or_magasin" on public.orders
  for select to authenticated
  using (buyer_user_id = auth.uid() or is_org_member(magasin_id));

create policy "orders update by magasin (status only)" on public.orders
  for update to authenticated
  using (is_org_member(magasin_id))
  with check (is_org_member(magasin_id));

create policy "orders admin all" on public.orders
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

create policy "order_items read with order" on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.buyer_user_id = auth.uid() or is_org_member(o.magasin_id))
    )
  );

create policy "order_items admin all" on public.order_items
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

-- 18. payments (read-only client, écrit par webhooks service_role)
-- -----------------------------------------------------------------------------
create policy "payments read payer_or_recipient" on public.payments
  for select to authenticated
  using (
    payer_user_id = auth.uid()
    or (recipient_org_id is not null and is_org_member(recipient_org_id))
  );

create policy "payments admin all" on public.payments
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());

-- 19. webhook_events (service_role uniquement)
-- -----------------------------------------------------------------------------
create policy "webhook_events admin read" on public.webhook_events
  for select to authenticated
  using (is_app_admin());
-- Aucune policy pour authenticated/anon en write : seul service_role peut insérer.

-- 20. consent_log
-- -----------------------------------------------------------------------------
create policy "consent_log insert self" on public.consent_log
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "consent_log read self" on public.consent_log
  for select to authenticated
  using (user_id = auth.uid() or is_app_admin());

-- Pas d'UPDATE/DELETE sur consent_log : c'est un historique légal.

-- 21. audit_log (read admin uniquement, pas d'insert client direct)
-- -----------------------------------------------------------------------------
create policy "audit_log read admin" on public.audit_log
  for select to authenticated
  using (is_app_admin());
-- INSERT via service_role uniquement (edge functions / triggers SECURITY DEFINER).
-- UPDATE/DELETE bloqués par trigger tg_block_audit_modifications.

-- 22. feature_flags
-- -----------------------------------------------------------------------------
create policy "feature_flags read authenticated" on public.feature_flags
  for select to authenticated using (true);

create policy "feature_flags read anon" on public.feature_flags
  for select to anon using (true);

create policy "feature_flags write admin" on public.feature_flags
  for all to authenticated
  using (is_app_admin())
  with check (is_app_admin());
