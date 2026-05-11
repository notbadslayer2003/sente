-- Migration 0049 : intégration Sendcloud
-- - Ajoute bpost à l'enum marketplace_carrier (Colissimo reste en place pour
--   compat, mais ne sera plus exposé via Sendcloud)
-- - Ajoute deux colonnes sur marketplace_orders pour tracker l'étiquette
--   Sendcloud (coût réel + parcel id, utile pour reconciliation et tracking)

ALTER TYPE marketplace_carrier ADD VALUE IF NOT EXISTS 'bpost';

ALTER TABLE marketplace_orders
    ADD COLUMN IF NOT EXISTS shipping_label_cost_cents INTEGER
    CHECK (shipping_label_cost_cents IS NULL OR shipping_label_cost_cents >= 0),
    ADD COLUMN IF NOT EXISTS sendcloud_parcel_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_sendcloud_parcel
    ON marketplace_orders (sendcloud_parcel_id)
    WHERE sendcloud_parcel_id IS NOT NULL;

COMMENT ON COLUMN marketplace_orders.shipping_label_cost_cents IS
    'Coût réel facturé par Sendcloud (≠ shipping_cents qui est ce que paie le buyer). Permet la réconciliation mensuelle vs facture Sendcloud.';

COMMENT ON COLUMN marketplace_orders.sendcloud_parcel_id IS
    'ID parcel Sendcloud (POST /parcels/). Utilisé pour requêter tracking, annuler étiquette, etc.';