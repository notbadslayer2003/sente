-- =============================================================================
-- 0045_marketplace_seller_shipping_address.sql
-- =============================================================================
-- Ajoute une adresse d'expédition dédiée pour les sellers marketplace.
--
-- Pourquoi pas réutiliser dac7_address_full ?
--   - dac7_address_full est un text libre format DAC7 ("rue, CP, ville, pays")
--     non parsable de manière fiable.
--   - L'adresse d'expédition peut différer de l'adresse fiscale : un seller
--     peut habiter à un endroit et expédier depuis un autre (chez ses parents,
--     son bureau, etc.).
--
-- Pourquoi pas réutiliser marketplace_addresses ?
--   - Cette table stocke historiquement les adresses BUYER (livraison achats).
--     Conceptuellement boueux d'y mettre une adresse expéditeur.
--
-- Les colonnes sont indépendamment nullable pour autoriser un onboarding
-- progressif. La vérification "adresse complète" se fera côté Server Action
-- markOrderAsShipped (8c.3) au moment où on en a besoin.
--
-- Contraintes CHECK alignées sur les regex MR V2 (web-service-dual-carrier-v-271).
-- =============================================================================

BEGIN;

ALTER TABLE public.marketplace_seller_accounts
    ADD COLUMN shipping_from_line1 text NULL,
    ADD COLUMN shipping_from_postal_code text NULL,
    ADD COLUMN shipping_from_city text NULL,
    ADD COLUMN shipping_from_country country_code NULL;

-- CHECK constraints : longueurs alignées sur les regex MR V2.
-- Validées seulement si la colonne est non null (NULL → CHECK passe).
ALTER TABLE public.marketplace_seller_accounts
    ADD CONSTRAINT marketplace_seller_accounts_shipping_from_line1_check
        CHECK (
            shipping_from_line1 IS NULL
                OR (length(shipping_from_line1) >= 3 AND length(shipping_from_line1) <= 200)
            );

ALTER TABLE public.marketplace_seller_accounts
    ADD CONSTRAINT marketplace_seller_accounts_shipping_from_postal_code_check
        CHECK (
            shipping_from_postal_code IS NULL
                OR (length(shipping_from_postal_code) >= 4 AND length(shipping_from_postal_code) <= 10)
            );

ALTER TABLE public.marketplace_seller_accounts
    ADD CONSTRAINT marketplace_seller_accounts_shipping_from_city_check
        CHECK (
            shipping_from_city IS NULL
                OR (length(shipping_from_city) >= 2 AND length(shipping_from_city) <= 100)
            );

-- Pas de check sur country : c'est un enum, déjà borné.

COMMIT;

-- =============================================================================
-- DOWN
-- =============================================================================
-- BEGIN;
-- ALTER TABLE public.marketplace_seller_accounts
--     DROP CONSTRAINT IF EXISTS marketplace_seller_accounts_shipping_from_line1_check,
--     DROP CONSTRAINT IF EXISTS marketplace_seller_accounts_shipping_from_postal_code_check,
--     DROP CONSTRAINT IF EXISTS marketplace_seller_accounts_shipping_from_city_check,
--     DROP COLUMN IF EXISTS shipping_from_line1,
--     DROP COLUMN IF EXISTS shipping_from_postal_code,
--     DROP COLUMN IF EXISTS shipping_from_city,
--     DROP COLUMN IF EXISTS shipping_from_country;
-- COMMIT;