-- =============================================================================
-- 0039_marketplace_orders_offer_id.sql
-- =============================================================================
-- Ajout d'un FK optionnel offer_id sur marketplace_orders pour tracer les
-- orders qui viennent d'une offre acceptée (vs achat direct au prix listing).
-- =============================================================================

ALTER TABLE marketplace_orders
    ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES marketplace_offers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_offer_id
    ON marketplace_orders(offer_id) WHERE offer_id IS NOT NULL;

COMMENT ON COLUMN marketplace_orders.offer_id IS
'FK marketplace_offers : null si achat direct au prix listing, sinon offre acceptée à l''origine de la commande';