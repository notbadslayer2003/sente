-- =============================================================================
-- 0042_marketplace_listings_select_via_definer.sql
-- =============================================================================
-- Suite de 0041 : la policy SELECT sur marketplace_listings faisait des EXISTS
-- directs sur marketplace_threads/offers/orders, dont les RLS référencent
-- elles-mêmes marketplace_listings → récursion infinie (PG 42P17).
--
-- Fix : on déplace la logique dans fn_user_has_marketplace_relation_to_listing,
-- déclarée SECURITY DEFINER. Les sous-requêtes tournent alors sous le rôle
-- propriétaire (postgres) qui bypass les RLS, ce qui casse la boucle.
--
-- Sécurité : la fonction est strictement scoped — elle n'accepte qu'un
-- listing_id + un user_id et ne retourne qu'un boolean. Aucune fuite de
-- données au-delà du "ce user a-t-il une relation marketplace avec ce
-- listing oui/non".
-- =============================================================================

BEGIN;

-- Drop la policy cassée de 0041
DROP POLICY IF EXISTS marketplace_listings_auth_select ON public.marketplace_listings;

-- Drop si rejouée (idempotent)
DROP FUNCTION IF EXISTS public.fn_user_has_marketplace_relation_to_listing(uuid, uuid);

-- =============================================================================
-- Fonction helper SECURITY DEFINER
-- =============================================================================
-- Bypass des RLS via SECURITY DEFINER pour briser la récursion.
-- search_path verrouillé sur public pour neutraliser l'attaque search_path
-- (best practice SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.fn_user_has_marketplace_relation_to_listing(
    p_listing_id uuid,
    p_user_id uuid
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
SELECT
    p_user_id IS NOT NULL AND (
        EXISTS (
            SELECT 1 FROM public.marketplace_threads
            WHERE listing_id = p_listing_id
              AND buyer_user_id = p_user_id
        )
            OR EXISTS (
            SELECT 1 FROM public.marketplace_offers
            WHERE listing_id = p_listing_id
              AND buyer_user_id = p_user_id
        )
            OR EXISTS (
            SELECT 1 FROM public.marketplace_orders
            WHERE listing_id = p_listing_id
              AND buyer_user_id = p_user_id
        )
        );
$$;

-- Restreint l'exécution aux rôles authentifiés (pas d'anon, pas de public)
REVOKE ALL ON FUNCTION public.fn_user_has_marketplace_relation_to_listing(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_user_has_marketplace_relation_to_listing(uuid, uuid) TO authenticated;

-- =============================================================================
-- Policy SELECT v2 (sans EXISTS récursifs)
-- =============================================================================
CREATE POLICY marketplace_listings_auth_select
ON public.marketplace_listings
FOR SELECT
                                                                                           TO authenticated
                                                                                           USING (
                                                                                           -- Cas 1 : listing public actif (short-circuit, cas dominant)
                                                                                           (status = 'active' AND deleted_at IS NULL)

                                                                                           -- Cas 2 : owner voit tous ses listings
                                                                                           OR seller_user_id = auth.uid()

                                                                                           -- Cas 3 : super-admin
                                                                                           OR fn_is_app_admin()

                                                                                           -- Cas 4 : buyer participant à un thread/offer/order sur ce listing
                                                                                           --   (la fonction bypass RLS via SECURITY DEFINER)
                                                                                           OR fn_user_has_marketplace_relation_to_listing(id, auth.uid())
                                                                                           );

COMMIT;

-- =============================================================================
-- DOWN
-- =============================================================================
-- BEGIN;
-- DROP POLICY IF EXISTS marketplace_listings_auth_select ON public.marketplace_listings;
-- DROP FUNCTION IF EXISTS public.fn_user_has_marketplace_relation_to_listing(uuid, uuid);
-- CREATE POLICY marketplace_listings_auth_select
-- ON public.marketplace_listings
-- FOR SELECT
-- TO authenticated
-- USING (
--     ((status = 'active' AND deleted_at IS NULL))
--     OR (seller_user_id = auth.uid())
--     OR fn_is_app_admin()
-- );
-- COMMIT;