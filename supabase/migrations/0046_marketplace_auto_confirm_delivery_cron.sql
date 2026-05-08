-- =============================================================================
-- 0047_marketplace_auto_confirm_delivery_cron.sql
-- =============================================================================
-- Auto-confirmation des livraisons après 10 jours sans action buyer.
--
-- Pourquoi 10j ? MR garde un colis 14 jours au point relais. Un buyer qui n'a
-- pas confirmé après 10j a soit récupéré le colis et oublié de cliquer, soit
-- le colis est resté au relais (et MR le renverra → état détecté plus tard).
-- 10j est un bon compromis pour ne pas bloquer le release escrow indéfiniment.
--
-- pg_cron est dispo nativement sur Supabase (extension à activer si pas encore).
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Fonction SQL : passe en 'delivered' tous les orders 'shipped' depuis > 10j
CREATE OR REPLACE FUNCTION public.fn_auto_confirm_marketplace_delivery()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_count int;
BEGIN
    -- 1. Update + capture des ids pour l'audit
WITH updated AS (
UPDATE marketplace_orders
SET status = 'delivered',
    delivered_at = now()
WHERE status = 'shipped'
  AND shipped_at < now() - INTERVAL '10 days'
    RETURNING id
    )
-- 2. Audit log : actor_user_id = NULL (action système), payload tag auto=true
INSERT INTO audit_log (actor_user_id, action, target_type, target_id, payload)
SELECT
    NULL,
    'marketplace_order.auto_confirmed_delivery',
    'marketplace_order',
    id,
    jsonb_build_object('reason', 'timeout_10_days', 'auto', true)
FROM updated;

GET DIAGNOSTICS v_count = ROW_COUNT;
RAISE NOTICE 'Auto-confirmed % marketplace deliveries', v_count;
END;
$$;

-- Restrict : seul postgres role peut exécuter (pas exposé via PostgREST/RPC)
REVOKE ALL ON FUNCTION public.fn_auto_confirm_marketplace_delivery() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_auto_confirm_marketplace_delivery() FROM authenticated;

-- Schedule : tous les jours à 3h UTC
SELECT cron.schedule(
               'marketplace-auto-confirm-delivery',
               '0 3 * * *',
               $$ SELECT public.fn_auto_confirm_marketplace_delivery(); $$
);

COMMIT;

-- =============================================================================
-- DOWN
-- =============================================================================
-- BEGIN;
-- SELECT cron.unschedule('marketplace-auto-confirm-delivery');
-- DROP FUNCTION IF EXISTS public.fn_auto_confirm_marketplace_delivery();
-- COMMIT;