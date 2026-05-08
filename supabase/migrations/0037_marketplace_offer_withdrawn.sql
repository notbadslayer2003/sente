-- =============================================================================
-- 0038_marketplace_offer_withdrawn.sql
-- =============================================================================
-- Ajout de la valeur 'withdrawn' à l'enum marketplace_offer_status.
-- Sémantique : le buyer retire son offre avant que le vendeur réponde.
-- Distinct de 'rejected' (vendeur refuse) et 'expired' (TTL atteint).
--
-- Note : ALTER TYPE ADD VALUE ne peut pas être en transaction.
-- Si Supabase migration plante avec "transaction block" → exécute la commande
-- directement dans le SQL Editor.
-- =============================================================================

ALTER TYPE marketplace_offer_status ADD VALUE IF NOT EXISTS 'withdrawn';

COMMENT ON TYPE marketplace_offer_status IS
    'Cycle de vie d''une offre : pending → accepted (vendeur) | rejected (vendeur) | withdrawn (buyer retire) | expired (TTL ou superseded par autre acceptation)';