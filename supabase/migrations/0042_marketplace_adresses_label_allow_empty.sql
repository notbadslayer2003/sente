-- =============================================================================
-- 0043_marketplace_addresses_label_allow_empty.sql
-- =============================================================================
-- Bug : la contrainte marketplace_addresses_label_check exigeait
--   length(label) >= 1, alors que le pattern projet est de stocker "" par
--   défaut sur les fields optional NOT NULL (cf addresses.ts, ligne d'entête).
-- Conséquence : tout INSERT depuis NewAddressForm sans label remplie était
--   rejeté → checkout impossible si l'user n'avait pas d'adresse pré-existante.
--
-- Fix : on drop la borne min, on garde la borne max. Aligne le comportement
--   avec line2/phone qui acceptent déjà le vide.
-- =============================================================================

BEGIN;

ALTER TABLE public.marketplace_addresses
DROP CONSTRAINT IF EXISTS marketplace_addresses_label_check;

ALTER TABLE public.marketplace_addresses
    ADD CONSTRAINT marketplace_addresses_label_check
        CHECK (length(label) <= 50);

COMMIT;

-- DOWN
-- BEGIN;
-- ALTER TABLE public.marketplace_addresses
--     DROP CONSTRAINT IF EXISTS marketplace_addresses_label_check;
-- ALTER TABLE public.marketplace_addresses
--     ADD CONSTRAINT marketplace_addresses_label_check
--     CHECK (length(label) >= 1 AND length(label) <= 50);
-- COMMIT;