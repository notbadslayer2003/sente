-- =============================================================================
-- 0040_marketplace_orders_session_id.sql
-- =============================================================================
-- Ajout d'une colonne stripe_checkout_session_id pour stocker l'ID de la
-- Stripe Checkout Session associée à l'order (utilisé pour idempotence et
-- retrieve quand le buyer revient sur la page checkout).
-- =============================================================================

ALTER TABLE marketplace_orders
    ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_session_id
    ON marketplace_orders(stripe_checkout_session_id)
    WHERE stripe_checkout_session_id IS NOT NULL;

COMMENT ON COLUMN marketplace_orders.stripe_checkout_session_id IS
'ID de la Stripe Checkout Session ouverte pour le paiement. Permet retrieve idempotente.';