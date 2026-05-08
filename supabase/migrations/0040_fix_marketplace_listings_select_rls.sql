-- =============================================================================
-- 0041_fix_marketplace_listings_select_rls.sql
-- =============================================================================
-- Bug : un buyer participant d'un thread/offre/order ne pouvait plus voir le
-- listing une fois que celui-ci passait en status != 'active' (typiquement
-- 'reserved' après acceptation d'une offre, ou 'sold' après paiement).
--
-- Conséquences UI :
--   - liste /profil/marketplace/messages affichait "Annonce supprimée"
--   - /profil/marketplace/checkout/offre/[id] retournait LISTING_NOT_FOUND
--
-- Fix : on élargit la policy SELECT authenticated pour autoriser également
-- la lecture aux users qui ont une relation marketplace existante avec le
-- listing (thread, offer, order). La RLS continue de filtrer correctement
-- les listings drafts/private du seller pour les autres users.
--
-- Note perf : la 1re clause `status='active' AND deleted_at IS NULL` est
-- toujours évaluée en premier (short-circuit OR), donc pour la majorité des
-- requêtes (browse public) on ne paie pas le coût des EXISTS.
-- =============================================================================

BEGIN;

-- Drop l'ancienne policy
DROP POLICY IF EXISTS marketplace_listings_auth_select ON public.marketplace_listings;

-- Recrée avec les clauses élargies
CREATE POLICY marketplace_listings_auth_select
ON public.marketplace_listings
FOR SELECT
                    TO authenticated
                    USING (
                    -- Cas 1 : listing publiquement visible (cas dominant, short-circuit)
                    (status = 'active' AND deleted_at IS NULL)

                    -- Cas 2 : owner voit toujours ses propres listings (drafts, reserved, sold, archived)
                    OR seller_user_id = auth.uid()

                    -- Cas 3 : super-admin Sente
                    OR fn_is_app_admin()

                    -- Cas 4 : buyer ayant initié un thread sur ce listing
                    --   (le seller est déjà couvert par cas 2)
                    OR EXISTS (
                    SELECT 1 FROM public.marketplace_threads t
                    WHERE t.listing_id = marketplace_listings.id
                    AND t.buyer_user_id = auth.uid()
                    )

                    -- Cas 5 : buyer ayant fait au moins une offre sur ce listing
                    OR EXISTS (
                    SELECT 1 FROM public.marketplace_offers o
                    WHERE o.listing_id = marketplace_listings.id
                    AND o.buyer_user_id = auth.uid()
                    )

                    -- Cas 6 : buyer ayant un order (même cancelled/refunded) sur ce listing
                    OR EXISTS (
                    SELECT 1 FROM public.marketplace_orders ord
                    WHERE ord.listing_id = marketplace_listings.id
                    AND ord.buyer_user_id = auth.uid()
                    )
                    );

COMMIT;

-- =============================================================================
-- DOWN (rollback)
-- =============================================================================
-- BEGIN;
-- DROP POLICY IF EXISTS marketplace_listings_auth_select ON public.marketplace_listings;
-- CREATE POLICY marketplace_listings_auth_select
-- ON public.marketplace_listings
-- FOR SELECT
-- TO authenticated
-- USING (
--     ((status = 'active'::marketplace_listing_status) AND (deleted_at IS NULL))
--     OR (seller_user_id = auth.uid())
--     OR fn_is_app_admin()
-- );
-- COMMIT;