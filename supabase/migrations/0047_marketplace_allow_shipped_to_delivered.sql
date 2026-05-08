-- =============================================================================
-- 0048_marketplace_allow_shipped_to_delivered.sql
-- =============================================================================
-- Patch trigger transition order :
-- 1. Ajoute la transition shipped → delivered dans la whitelist (Server Action
--    buyer "j'ai reçu mon colis"). Le contrôle d'identité est dans l'action.
-- 2. Ajoute un bypass via setting de session 'marketplace.system_action' pour
--    permettre aux fonctions SECURITY DEFINER (cron pg_cron) de transitionner
--    sans auth.uid(). Le flag est SET LOCAL → ne fuit pas hors transaction.
--
-- Patch aussi fn_auto_confirm_marketplace_delivery pour positionner le flag.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Trigger transition : ajoute le bypass système + transition shipped→delivered
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_marketplace_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Pas de validation à l'INSERT
    IF TG_OP = 'INSERT' THEN
        RETURN NEW;
END IF;

    -- Si le status n'a pas changé, on laisse passer
    IF NEW.status = OLD.status THEN
        RETURN NEW;
END IF;

    -- Bypass pour admin et service_role (refunds, résolution litige, corrections)
    IF fn_is_app_admin() OR auth.role() = 'service_role' THEN
        RETURN NEW;
END IF;

    -- NEW : Bypass pour actions système (cron, fonctions SECURITY DEFINER
    -- qui positionnent ce flag LOCAL à leur transaction).
    -- Pas accessible côté client : seul du SQL serveur peut SET ce param.
    IF current_setting('marketplace.system_action', true) = 'true' THEN
        RETURN NEW;
END IF;

    -- Transitions autorisées côté user (buyer/seller)
    IF NOT (
        -- Annulation buyer avant expédition
        (OLD.status = 'paid_awaiting_shipment' AND NEW.status = 'cancelled')
        -- Marquage expédition par seller
        OR (OLD.status = 'paid_awaiting_shipment' AND NEW.status = 'shipped')
        -- NEW : Confirmation réception manuelle par buyer (étape 8d)
        OR (OLD.status = 'shipped' AND NEW.status = 'delivered')
        -- Confirmation finale par buyer (release escrow)
        OR (OLD.status = 'delivered' AND NEW.status = 'released')
        OR (OLD.status = 'released' AND NEW.status = 'closed')
        -- Ouverture litige (le passage en 'disputed' se fait via le trigger d'INSERT
        --   sur marketplace_disputes, qui peut update l'order status)
        OR (OLD.status IN ('shipped', 'delivered') AND NEW.status = 'disputed')
    ) THEN
        RAISE EXCEPTION 'Transition order interdite : % → % (utilisez les Server Actions ou contactez un admin)',
            OLD.status, NEW.status
            USING ERRCODE = 'check_violation';
END IF;

RETURN NEW;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 2. Fonction cron : SET LOCAL le flag avant de toucher aux orders
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_auto_confirm_marketplace_delivery()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_count int;
BEGIN
    -- 3e arg = true → variable LOCAL à la transaction (n'est plus définie hors function)
    PERFORM set_config('marketplace.system_action', 'true', true);

WITH updated AS (
UPDATE marketplace_orders
SET status = 'delivered',
    delivered_at = now()
WHERE status = 'shipped'
  AND shipped_at < now() - INTERVAL '10 days'
    RETURNING id
    )
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

COMMIT;