-- =============================================================================
-- 0032_plans_setup.sql
--
-- 1. Création de l'enum etang_plan (vitrine | crm)
-- 2. Ajout de la colonne etang_details.plan
-- 3. Migration des données existantes : tous les étangs en 'vitrine' par défaut
-- 4. Nettoyage de l'enum magasin_plan : suppression de 'boutique_plus'
--    (les magasins en boutique_plus existants migrent vers 'pro')
-- =============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Enum etang_plan
-- ----------------------------------------------------------------------------
-- On crée un nouvel enum pour les plans étang. Convention identique aux
-- magasins (lower_snake_case, valeur par défaut = plan gratuit).
create type public.etang_plan as enum ('vitrine', 'crm');

-- ----------------------------------------------------------------------------
-- 2. Colonne etang_details.plan
-- ----------------------------------------------------------------------------
-- Default 'vitrine' = plan gratuit. Tous les étangs existants en DB
-- atterrissent sur 'vitrine' automatiquement.
-- NOT NULL pour éviter les états ambigus (cohérent avec magasin_details.plan).
alter table public.etang_details
    add column plan public.etang_plan not null default 'vitrine';

-- ----------------------------------------------------------------------------
-- 3. Nettoyage enum magasin_plan : drop boutique_plus
-- ----------------------------------------------------------------------------
-- Postgres ne sait pas DROP une valeur d'enum directement.
-- On doit recréer l'enum sans la valeur, migrer la colonne, puis swap.

-- 3.1. Migration des magasins en boutique_plus vers pro (avant le swap)
update public.magasin_details
set plan = 'pro'::magasin_plan
where plan = 'boutique_plus'::magasin_plan;

-- 3.2. Création du nouvel enum sans boutique_plus
create type public.magasin_plan_new as enum ('starter', 'pro');

-- 3.3. Swap de la colonne sur le nouvel enum
-- USING permet de mapper l'ancienne valeur à la nouvelle (cast via texte)
alter table public.magasin_details
    alter column plan drop default;

alter table public.magasin_details
alter column plan type public.magasin_plan_new
    using plan::text::public.magasin_plan_new;

alter table public.magasin_details
    alter column plan set default 'starter'::public.magasin_plan_new;

-- 3.4. Drop l'ancien enum, rename le nouveau
drop type public.magasin_plan;
alter type public.magasin_plan_new rename to magasin_plan;

commit;