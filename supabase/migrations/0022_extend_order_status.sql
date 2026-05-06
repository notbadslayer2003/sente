-- =============================================================================
-- Sente — Extension enum order_status
-- =============================================================================
-- Ajout de 'ready_for_pickup' pour le flow click & collect.
-- ALTER TYPE ADD VALUE doit être seul dans sa transaction (limitation Postgres),
-- donc on isole dans une migration dédiée.
-- =============================================================================

alter type public.order_status add value if not exists 'ready_for_pickup' before 'shipped';