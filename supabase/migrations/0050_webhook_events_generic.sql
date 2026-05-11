-- 0050_webhook_events_generic.sql
-- Généralise webhook_events pour supporter plusieurs providers (Stripe, Sendcloud, …)
-- Migration sûre : DEFAULT 'stripe' couvre les rows existantes.

BEGIN;

-- 1. Drop le CHECK pattern Stripe-only
ALTER TABLE webhook_events
DROP CONSTRAINT IF EXISTS webhook_events_stripe_event_id_check;

-- 2. Ajout colonne provider (default 'stripe' = couvre l'historique)
ALTER TABLE webhook_events
    ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'stripe';

-- 3. Renomme stripe_event_id → event_id
ALTER TABLE webhook_events
    RENAME COLUMN stripe_event_id TO event_id;

-- 4. PK composite (provider, event_id)
ALTER TABLE webhook_events
DROP CONSTRAINT IF EXISTS webhook_events_pkey;
ALTER TABLE webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (provider, event_id);

-- 5. CHECK conditionnel : Stripe garde son pattern, autres providers libres
ALTER TABLE webhook_events
    ADD CONSTRAINT webhook_events_event_id_check
        CHECK (
            (provider = 'stripe' AND event_id ~ '^evt_')
                OR provider != 'stripe'
    );

-- 6. Vérifier que delivered_at existe sur marketplace_orders (sinon add)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'marketplace_orders' AND column_name = 'delivered_at'
    ) THEN
ALTER TABLE marketplace_orders ADD COLUMN delivered_at TIMESTAMPTZ;
END IF;
END$$;

COMMIT;