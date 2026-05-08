-- =============================================================================
-- Migration 0036 — RLS marketplace C2C
-- =============================================================================
-- Active RLS sur les 14 tables marketplace + 2 triggers de validation métier.
-- Rôles ciblés (notation Supabase) :
--   - anon            : utilisateur non connecté
--   - authenticated   : utilisateur connecté (pecheur, ou pecheur+KYC)
--   - service_role    : webhooks/crons/Server Actions admin → bypass RLS
--   - fn_is_app_admin : super-admin Sente (table app_admins)
--
-- Convention de nommage des policies :
--   <table>_<scope>_<action>  ex: marketplace_listings_owner_update
-- =============================================================================


-- =============================================================================
-- 1. Helper fn_is_app_admin (idempotent : créé si absent)
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_is_app_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
SELECT EXISTS (
    SELECT 1 FROM app_admins WHERE user_id = auth.uid()
);
$$;

COMMENT ON FUNCTION fn_is_app_admin IS
  'Vrai si l''utilisateur courant est dans la table app_admins. Réutilisable dans toutes les policies marketplace.';


-- =============================================================================
-- 2. Activation RLS sur toutes les tables marketplace
-- =============================================================================
ALTER TABLE marketplace_seller_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_brands            ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listing_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listing_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listing_boosts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_addresses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_offers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_threads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_disputes          ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- CLUSTER A — CATALOGUE
-- =============================================================================

-- ----- marketplace_categories : taxonomie publique
-- Lecture libre (anon + auth). Modifications = admin only.
CREATE POLICY marketplace_categories_anon_select ON marketplace_categories
  FOR SELECT TO anon
                 USING (true);

CREATE POLICY marketplace_categories_auth_select ON marketplace_categories
  FOR SELECT TO authenticated
                 USING (true);

CREATE POLICY marketplace_categories_admin_all ON marketplace_categories
  FOR ALL TO authenticated
  USING (fn_is_app_admin())
  WITH CHECK (fn_is_app_admin());


-- ----- marketplace_brands
-- Lecture publique des marques verified.
-- Authenticated voient verified + leurs propres propositions non-verified.
-- Admin voit tout. Création par tout user authentifié (verified=false par défaut).
CREATE POLICY marketplace_brands_anon_select ON marketplace_brands
  FOR SELECT TO anon
                        USING (verified = true);

CREATE POLICY marketplace_brands_auth_select ON marketplace_brands
  FOR SELECT TO authenticated
                 USING (
                 verified = true
                 OR created_by_user_id = auth.uid()
                 OR fn_is_app_admin()
                 );

CREATE POLICY marketplace_brands_auth_insert ON marketplace_brands
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND verified = false  -- impossible de créer une brand verified sans être admin
  );

CREATE POLICY marketplace_brands_admin_all ON marketplace_brands
  FOR ALL TO authenticated
  USING (fn_is_app_admin())
  WITH CHECK (fn_is_app_admin());


-- ----- marketplace_listings
-- SELECT :
--   anon       → status='active' AND deleted_at IS NULL
--   auth       → idem + own listings (tous statuts)
--   admin      → tout
-- INSERT     → owner pour son seller_user_id, status='draft' ou 'pending_review'
-- UPDATE     → owner own listings + admin
-- DELETE     → admin only (soft delete via UPDATE deleted_at pour les owners)
CREATE POLICY marketplace_listings_anon_select ON marketplace_listings
  FOR SELECT TO anon
                               USING (status = 'active' AND deleted_at IS NULL);

CREATE POLICY marketplace_listings_auth_select ON marketplace_listings
  FOR SELECT TO authenticated
                 USING (
                 (status = 'active' AND deleted_at IS NULL)
                 OR seller_user_id = auth.uid()
                 OR fn_is_app_admin()
                 );

CREATE POLICY marketplace_listings_owner_insert ON marketplace_listings
  FOR INSERT TO authenticated
  WITH CHECK (
    seller_user_id = auth.uid()
    AND status IN ('draft', 'pending_review')
    -- Le passage en 'active' est contrôlé par les triggers (KYC, anti-pros)
  );

CREATE POLICY marketplace_listings_owner_update ON marketplace_listings
  FOR UPDATE TO authenticated
                        USING (seller_user_id = auth.uid() AND deleted_at IS NULL)
      WITH CHECK (seller_user_id = auth.uid());

CREATE POLICY marketplace_listings_admin_all ON marketplace_listings
  FOR ALL TO authenticated
  USING (fn_is_app_admin())
  WITH CHECK (fn_is_app_admin());


-- ----- marketplace_listing_photos
-- Suit la visibilité du listing parent.
CREATE POLICY marketplace_listing_photos_anon_select ON marketplace_listing_photos
  FOR SELECT TO anon
                        USING (
                        EXISTS (
                        SELECT 1 FROM marketplace_listings l
                        WHERE l.id = listing_id
                        AND l.status = 'active'
                        AND l.deleted_at IS NULL
                        )
                        );

CREATE POLICY marketplace_listing_photos_auth_select ON marketplace_listing_photos
  FOR SELECT TO authenticated
                 USING (
                 EXISTS (
                 SELECT 1 FROM marketplace_listings l
                 WHERE l.id = listing_id
                 AND (
                 (l.status = 'active' AND l.deleted_at IS NULL)
                 OR l.seller_user_id = auth.uid()
                 )
                 )
                 OR fn_is_app_admin()
                 );

CREATE POLICY marketplace_listing_photos_owner_write ON marketplace_listing_photos
  FOR ALL TO authenticated
  USING (fn_marketplace_is_listing_owner(listing_id))
  WITH CHECK (fn_marketplace_is_listing_owner(listing_id));

CREATE POLICY marketplace_listing_photos_admin_all ON marketplace_listing_photos
  FOR ALL TO authenticated
  USING (fn_is_app_admin())
  WITH CHECK (fn_is_app_admin());


-- ----- marketplace_listing_favorites : own only
CREATE POLICY marketplace_listing_favorites_owner_all ON marketplace_listing_favorites
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY marketplace_listing_favorites_admin_select ON marketplace_listing_favorites
  FOR SELECT TO authenticated
                                      USING (fn_is_app_admin());


-- ----- marketplace_listing_boosts
-- SELECT : owner du listing + admin
-- INSERT : owner du listing (la cohérence avec un payment kind='c2c_boost' validé
--         est garantie par les Server Actions, pas par la RLS)
-- UPDATE/DELETE : admin only (status géré par cron)
CREATE POLICY marketplace_listing_boosts_owner_select ON marketplace_listing_boosts
  FOR SELECT TO authenticated
                 USING (fn_marketplace_is_listing_owner(listing_id) OR fn_is_app_admin());

CREATE POLICY marketplace_listing_boosts_owner_insert ON marketplace_listing_boosts
  FOR INSERT TO authenticated
  WITH CHECK (fn_marketplace_is_listing_owner(listing_id));

CREATE POLICY marketplace_listing_boosts_admin_write ON marketplace_listing_boosts
  FOR ALL TO authenticated
  USING (fn_is_app_admin())
  WITH CHECK (fn_is_app_admin());


-- =============================================================================
-- CLUSTER B — TRANSACTIONS
-- =============================================================================

-- ----- marketplace_addresses : own only (admin read-only support)
CREATE POLICY marketplace_addresses_owner_all ON marketplace_addresses
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY marketplace_addresses_admin_select ON marketplace_addresses
  FOR SELECT TO authenticated
                                      USING (fn_is_app_admin());


-- ----- marketplace_offers
-- SELECT : buyer + seller du listing + admin
-- INSERT : authenticated comme buyer (trigger empêche l'auto-offre)
-- UPDATE : buyer (cancel) ou seller (accept/reject/counter) + admin
-- DELETE : admin only (on garde l'historique)
CREATE POLICY marketplace_offers_party_select ON marketplace_offers
  FOR SELECT TO authenticated
                 USING (
                 buyer_user_id = auth.uid()
                 OR EXISTS (
                 SELECT 1 FROM marketplace_listings l
                 WHERE l.id = listing_id AND l.seller_user_id = auth.uid()
                 )
                 OR fn_is_app_admin()
                 );

CREATE POLICY marketplace_offers_buyer_insert ON marketplace_offers
  FOR INSERT TO authenticated
  WITH CHECK (
    buyer_user_id = auth.uid()
    AND status = 'pending'  -- on ne crée jamais une offre dans un autre état
    AND EXISTS (
      SELECT 1 FROM marketplace_listings l
      WHERE l.id = listing_id
        AND l.status = 'active'
        AND l.deleted_at IS NULL
    )
  );

CREATE POLICY marketplace_offers_party_update ON marketplace_offers
  FOR UPDATE TO authenticated
                        USING (
                        buyer_user_id = auth.uid()
                        OR EXISTS (
                        SELECT 1 FROM marketplace_listings l
                        WHERE l.id = listing_id AND l.seller_user_id = auth.uid()
                        )
                        )
      WITH CHECK (
                        buyer_user_id = auth.uid()
                        OR EXISTS (
                        SELECT 1 FROM marketplace_listings l
                        WHERE l.id = listing_id AND l.seller_user_id = auth.uid()
                        )
                        );

CREATE POLICY marketplace_offers_admin_all ON marketplace_offers
  FOR ALL TO authenticated
  USING (fn_is_app_admin())
  WITH CHECK (fn_is_app_admin());


-- ----- marketplace_orders
-- SELECT : buyer + seller + admin
-- INSERT : buyer himself (contrôle complet par Server Action via service_role
--         car Stripe PI doit déjà exister + verrou listing — donc en pratique
--         on bypasse RLS via service_role lors de la création)
-- UPDATE : buyer ou seller (transitions strictes contrôlées par triggers + Server Actions)
-- DELETE : interdit
CREATE POLICY marketplace_orders_party_select ON marketplace_orders
  FOR SELECT TO authenticated
                        USING (
                        buyer_user_id = auth.uid()
                        OR seller_user_id = auth.uid()
                        OR fn_is_app_admin()
                        );

CREATE POLICY marketplace_orders_buyer_insert ON marketplace_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    buyer_user_id = auth.uid()
    AND status = 'pending_payment'
  );

CREATE POLICY marketplace_orders_party_update ON marketplace_orders
  FOR UPDATE TO authenticated
                        USING (
                        buyer_user_id = auth.uid()
                        OR seller_user_id = auth.uid()
                        )
      WITH CHECK (
                        buyer_user_id = auth.uid()
                        OR seller_user_id = auth.uid()
                        );

CREATE POLICY marketplace_orders_admin_all ON marketplace_orders
  FOR ALL TO authenticated
  USING (fn_is_app_admin())
  WITH CHECK (fn_is_app_admin());


-- =============================================================================
-- CLUSTER C — COMMUNICATION
-- =============================================================================

-- ----- marketplace_threads
-- SELECT/INSERT : participants
-- UPDATE : interdit aux users (last_message_at géré par trigger)
-- DELETE : admin only
CREATE POLICY marketplace_threads_party_select ON marketplace_threads
  FOR SELECT TO authenticated
                        USING (
                        buyer_user_id = auth.uid()
                        OR seller_user_id = auth.uid()
                        OR fn_is_app_admin()
                        );

CREATE POLICY marketplace_threads_buyer_insert ON marketplace_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    buyer_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM marketplace_listings l
      WHERE l.id = listing_id
        AND l.seller_user_id = seller_user_id  -- cohérence avec le listing
        AND l.deleted_at IS NULL
    )
  );

CREATE POLICY marketplace_threads_admin_all ON marketplace_threads
  FOR ALL TO authenticated
  USING (fn_is_app_admin())
  WITH CHECK (fn_is_app_admin());


-- ----- marketplace_messages
-- ATTENTION : pas de column-level RLS native PG.
-- raw_body est techniquement lisible par les participants mais la convention DAL
-- Sente exclut systématiquement raw_body des SELECT côté authenticated.
-- Côté code : lib/dal/marketplace-messages.ts utilise getMessages() qui SELECT
-- toutes les colonnes SAUF raw_body. Une fonction admin séparée
-- getMessageRawBody() vérifie fn_is_app_admin() avant retour.
CREATE POLICY marketplace_messages_party_select ON marketplace_messages
  FOR SELECT TO authenticated
                               USING (fn_marketplace_is_thread_participant(thread_id) OR fn_is_app_admin());

CREATE POLICY marketplace_messages_sender_insert ON marketplace_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND fn_marketplace_is_thread_participant(thread_id)
  );

-- read_at peut être mis à jour par le destinataire (pas le sender)
CREATE POLICY marketplace_messages_recipient_mark_read ON marketplace_messages
  FOR UPDATE TO authenticated
                        USING (
                        fn_marketplace_is_thread_participant(thread_id)
                        AND sender_user_id != auth.uid()
                        )
      WITH CHECK (
                        fn_marketplace_is_thread_participant(thread_id)
                        AND sender_user_id != auth.uid()
                        );

CREATE POLICY marketplace_messages_admin_all ON marketplace_messages
  FOR ALL TO authenticated
  USING (fn_is_app_admin())
  WITH CHECK (fn_is_app_admin());


-- =============================================================================
-- CLUSTER D — CONFIANCE & CONFORMITÉ
-- =============================================================================

-- ----- marketplace_seller_accounts
-- SELECT : own row + admin
-- INSERT : self (création initiale du compte vendeur)
-- UPDATE/DELETE : admin only — toutes les transitions KYC, DAC7, compteurs YTD
--                 sont gérées par webhooks (service_role bypass RLS) et triggers.
--                 Pour les actions user comme "accepter vendor_terms", utiliser
--                 une RPC SECURITY DEFINER dédiée.
CREATE POLICY marketplace_seller_accounts_owner_select ON marketplace_seller_accounts
  FOR SELECT TO authenticated
                        USING (user_id = auth.uid() OR fn_is_app_admin());

CREATE POLICY marketplace_seller_accounts_owner_insert ON marketplace_seller_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND kyc_status = 'not_started'  -- création toujours en not_started
    AND stripe_account_id IS NULL
    AND stripe_charges_enabled = false
    AND stripe_payouts_enabled = false
  );

CREATE POLICY marketplace_seller_accounts_admin_all ON marketplace_seller_accounts
  FOR ALL TO authenticated
  USING (fn_is_app_admin())
  WITH CHECK (fn_is_app_admin());


-- ----- marketplace_reviews
-- SELECT : public (les notes sont publiques sur les profils)
-- INSERT : rater himself (trigger valide la fenêtre 14j et la cohérence rôles/order)
-- UPDATE : interdit aux users (review immuable)
-- DELETE : admin only
CREATE POLICY marketplace_reviews_anon_select ON marketplace_reviews
  FOR SELECT TO anon
                               USING (true);

CREATE POLICY marketplace_reviews_auth_select ON marketplace_reviews
  FOR SELECT TO authenticated
                 USING (true);

CREATE POLICY marketplace_reviews_rater_insert ON marketplace_reviews
  FOR INSERT TO authenticated
  WITH CHECK (rater_user_id = auth.uid());

CREATE POLICY marketplace_reviews_admin_all ON marketplace_reviews
  FOR ALL TO authenticated
  USING (fn_is_app_admin())
  WITH CHECK (fn_is_app_admin());


-- ----- marketplace_disputes
-- SELECT : participants de l'order + admin
-- INSERT : buyer of order seulement (trigger valide cohérence)
-- UPDATE : admin only (résolution)
-- DELETE : admin only
CREATE POLICY marketplace_disputes_party_select ON marketplace_disputes
  FOR SELECT TO authenticated
                               USING (
                               fn_marketplace_is_order_party(order_id)
                               OR fn_is_app_admin()
                               );

CREATE POLICY marketplace_disputes_buyer_insert ON marketplace_disputes
  FOR INSERT TO authenticated
  WITH CHECK (
    opened_by_user_id = auth.uid()
    AND status = 'open'
    AND resolved_at IS NULL
    AND resolved_by_admin_id IS NULL
    AND EXISTS (
      SELECT 1 FROM marketplace_orders o
      WHERE o.id = order_id
        AND o.buyer_user_id = auth.uid()
        AND o.status IN ('shipped', 'delivered')  -- on n'ouvre litige qu'après expédition
    )
  );

CREATE POLICY marketplace_disputes_admin_all ON marketplace_disputes
  FOR ALL TO authenticated
  USING (fn_is_app_admin())
  WITH CHECK (fn_is_app_admin());


-- =============================================================================
-- 3. Triggers de validation métier additionnels
-- =============================================================================

-- ----- Validation review : order doit être 'closed', fenêtre 14j, rôles cohérents
CREATE OR REPLACE FUNCTION trg_marketplace_review_validate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
v_buyer_id uuid;
  v_seller_id uuid;
  v_status marketplace_order_status;
  v_closed_at timestamptz;
BEGIN
SELECT buyer_user_id, seller_user_id, status, closed_at
INTO v_buyer_id, v_seller_id, v_status, v_closed_at
FROM marketplace_orders WHERE id = NEW.order_id;

IF NOT FOUND THEN
    RAISE EXCEPTION 'Order introuvable' USING ERRCODE = 'foreign_key_violation';
END IF;

  IF v_status != 'closed' OR v_closed_at IS NULL THEN
    RAISE EXCEPTION 'Une review ne peut être créée que sur un order finalisé (status = closed)'
      USING ERRCODE = 'check_violation';
END IF;

  IF v_closed_at + interval '14 days' < now() THEN
    RAISE EXCEPTION 'La fenêtre de notation de 14 jours est dépassée'
      USING ERRCODE = 'check_violation';
END IF;

  -- Cohérence rôle / parties de l'order
  IF NEW.role = 'buyer' THEN
    IF v_buyer_id != NEW.rater_user_id THEN
      RAISE EXCEPTION 'role=buyer : seul l''acheteur de l''order peut noter ainsi'
        USING ERRCODE = 'check_violation';
END IF;
    IF v_seller_id != NEW.rated_user_id THEN
      RAISE EXCEPTION 'role=buyer : la cible de la note doit être le vendeur de l''order'
        USING ERRCODE = 'check_violation';
END IF;
ELSE  -- role = 'seller'
    IF v_seller_id != NEW.rater_user_id THEN
      RAISE EXCEPTION 'role=seller : seul le vendeur de l''order peut noter ainsi'
        USING ERRCODE = 'check_violation';
END IF;
    IF v_buyer_id != NEW.rated_user_id THEN
      RAISE EXCEPTION 'role=seller : la cible de la note doit être l''acheteur de l''order'
        USING ERRCODE = 'check_violation';
END IF;
END IF;

RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_reviews_validate
    BEFORE INSERT ON marketplace_reviews
    FOR EACH ROW EXECUTE FUNCTION trg_marketplace_review_validate();


-- ----- Verrouillage des transitions order : empêche les sauts d'état illogiques
-- Les transitions valides sont définies en machine d'état explicite.
CREATE OR REPLACE FUNCTION trg_marketplace_order_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Pas de validation à l'INSERT
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
END IF;

  -- Si le status n'a pas changé, on laisse passer
  IF NEW.status = OLD.status THEN
    RETURN NEW;
END IF;

  -- Bypass pour admin et service_role (refunds, résolution litige, corrections)
  IF fn_is_app_admin() OR auth.role() = 'service_role' THEN
    RETURN NEW;
END IF;

  -- Transitions autorisées côté user (buyer/seller)
  IF NOT (
    -- Annulation buyer avant expédition
    (OLD.status = 'paid_awaiting_shipment' AND NEW.status = 'cancelled')
    -- Marquage expédition par seller
    OR (OLD.status = 'paid_awaiting_shipment' AND NEW.status = 'shipped')
    -- Confirmation réception manuelle par buyer
    OR (OLD.status = 'delivered' AND NEW.status = 'released')
    OR (OLD.status = 'released' AND NEW.status = 'closed')
    -- Ouverture litige (le passage en 'disputed' se fait via le trigger d'INSERT
    --   sur marketplace_disputes, qui peut update l'order status)
    OR (OLD.status IN ('shipped', 'delivered') AND NEW.status = 'disputed')
  ) THEN
    RAISE EXCEPTION 'Transition order interdite : % → % (utilisez les Server Actions ou contactez un admin)',
      OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
END IF;

RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_orders_status_transition
    BEFORE UPDATE OF status ON marketplace_orders
    FOR EACH ROW EXECUTE FUNCTION trg_marketplace_order_status_transition();


-- =============================================================================
-- 4. Vérifications post-application
-- =============================================================================
DO $$
DECLARE
v_rls_count integer;
  v_policy_count integer;
BEGIN
  -- Toutes les tables marketplace doivent avoir RLS activé
SELECT COUNT(*) INTO v_rls_count
FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname LIKE 'marketplace_%'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true;
ASSERT v_rls_count = 14, format('RLS pas activé sur toutes les tables : %s/14', v_rls_count);

  -- Au moins 30 policies créées
SELECT COUNT(*) INTO v_policy_count
FROM pg_policies
WHERE schemaname = 'public' AND tablename LIKE 'marketplace_%';
ASSERT v_policy_count >= 30, format('Policies manquantes : %s', v_policy_count);

  RAISE NOTICE 'Migration 0036 OK : RLS activée sur 14 tables, % policies créées', v_policy_count;
END;
$$;