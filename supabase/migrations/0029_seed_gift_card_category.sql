-- =============================================================================
-- Sente — Seed catégorie "Cartes cadeaux"
-- =============================================================================
-- Catégorie racine, slug 'cartes-cadeaux'. UUID hardcodé pour pouvoir y faire
-- référence côté code (pré-sélection au form gift_card).
-- =============================================================================

insert into public.product_categories (
    id, slug, name, parent_id, display_order
)
values (
           '00000000-0000-0000-0099-000000000001'::uuid,
           'cartes-cadeaux',
           'Cartes cadeaux',
           null,
           99  -- en bas de la liste, c'est secondaire
       )
    on conflict (id) do nothing;