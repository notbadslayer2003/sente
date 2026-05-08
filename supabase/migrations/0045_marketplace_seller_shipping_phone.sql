-- =============================================================================
-- 0046_marketplace_seller_shipping_phone.sql
-- =============================================================================
-- Oubli de 0045 : MR V2 requiert un téléphone Sender obligatoire pour la
-- création d'étiquette (regex stricte par pays). On l'ajoute.
-- =============================================================================

BEGIN;

ALTER TABLE public.marketplace_seller_accounts
    ADD COLUMN shipping_from_phone text NULL;

ALTER TABLE public.marketplace_seller_accounts
    ADD CONSTRAINT marketplace_seller_accounts_shipping_from_phone_check
        CHECK (
            shipping_from_phone IS NULL
                OR (length(shipping_from_phone) >= 8 AND length(shipping_from_phone) <= 20)
            );

COMMIT;

-- DOWN
-- BEGIN;
-- ALTER TABLE public.marketplace_seller_accounts
--     DROP CONSTRAINT IF EXISTS marketplace_seller_accounts_shipping_from_phone_check,
--     DROP COLUMN IF EXISTS shipping_from_phone;
-- COMMIT;