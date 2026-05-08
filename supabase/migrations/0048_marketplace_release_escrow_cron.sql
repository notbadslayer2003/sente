-- =============================================================================
-- 0049_marketplace_release_escrow_cron.sql
-- =============================================================================
-- Release escrow T+48h après delivered :
-- 1. Ajoute c2c_release au CHECK kind de payments (sinon INSERT plante)
-- 2. Active pg_net pour permettre des HTTP calls depuis le cron
-- 3. Schedule pg_cron toutes les 6h qui hit l'Edge Function
--
-- Le secret HTTP est lu depuis app.cron_release_escrow_secret (à set
-- manuellement avant l'apply via ALTER DATABASE — instructions en footer).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Ajout c2c_release au CHECK constraint
-- -----------------------------------------------------------------------------
ALTER TABLE public.payments DROP CONSTRAINT payments_kind_check;
ALTER TABLE public.payments
    ADD CONSTRAINT payments_kind_check
        CHECK (
            kind = ANY (ARRAY[
                            'etang_subscription'::text,
                        'order'::text,
                        'event_registration'::text,
                        'platform_fee'::text,
                        'refund'::text,
                        'c2c_escrow'::text,
                        'c2c_boost'::text,
                        'c2c_release'::text
        ])
            );

-- -----------------------------------------------------------------------------
-- 2. Extension pg_net (déjà incluse Supabase, idempotent)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net;

-- -----------------------------------------------------------------------------
-- 3. Schedule pg_cron : toutes les 6h, POST l'Edge Function
-- -----------------------------------------------------------------------------
-- IMPORTANT : remplace <project-ref> par ton project-ref Supabase
--             (ex: si ton URL est https://abc1234567.supabase.co alors c'est abc1234567)
SELECT cron.schedule(
               'marketplace-release-escrow',
               '0 */6 * * *',
               $$
                   SELECT net.http_post(
        url := 'https://<project-ref>.supabase.co/functions/v1/marketplace-release-escrow',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_release_escrow_secret' LIMIT 1)
                   ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
    );
$$
);

COMMIT;

-- =============================================================================
-- À FAIRE MANUELLEMENT AVANT D'APPLIQUER LA MIGRATION
-- =============================================================================
-- Dans Supabase SQL editor (en superuser) :
--
--   ALTER DATABASE postgres SET app.cron_release_escrow_secret = 'TON_SECRET_LONG_RANDOM';
--
-- Puis reload la connexion DB. Le secret doit MATCHER celui que tu set dans
-- les secrets de l'Edge Function (étape 4).
--
-- Génère un secret fort :
--   openssl rand -hex 32
-- =============================================================================

-- =============================================================================
-- DOWN
-- =============================================================================
-- BEGIN;
-- SELECT cron.unschedule('marketplace-release-escrow');
-- ALTER TABLE public.payments DROP CONSTRAINT payments_kind_check;
-- ALTER TABLE public.payments ADD CONSTRAINT payments_kind_check CHECK (
--     kind = ANY (ARRAY['etang_subscription','order','event_registration',
--                       'platform_fee','refund','c2c_escrow','c2c_boost'])
-- );
-- COMMIT;