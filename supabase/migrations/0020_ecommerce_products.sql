-- =============================================================================
-- Sente — Phase V1.5 e-commerce : foundation produits
-- =============================================================================
-- Cette migration pose la fondation du catalogue produits pour les magasins :
--   • Taxonomie Sente fixe (catégories hiérarchiques 2 niveaux)
--   • Produits + variantes avec dimensions/options
--   • Frais de livraison configurables par magasin (shop_settings)
--   • RLS strictes (lecture publique pour produits publiés, écriture par owner/admin/staff)
--
-- Ce qu'on N'AJOUTE PAS dans cette migration (mais qui suit) :
--   • Bons cadeaux (0022)
--   • Box mensuelles (0023)
--   • Carts + orders (0021, à venir session 3)
--   • Signalements étendus à 'order' (session 6)
-- =============================================================================

-- =============================================================================
-- 1. Catégories produits (taxonomie Sente fixe, hiérarchique 2 niveaux)
-- =============================================================================
-- Une catégorie a soit un parent_id (= catégorie niveau 2) soit pas (= niveau 1).
-- Un produit pointe TOUJOURS vers une catégorie niveau 2 (qui implique son niveau 1).
-- Slug unique global pour permettre des URL types /boutique?category=cannes-carpe.

create table if not exists public.product_categories (
                                                         id              uuid primary key default gen_random_uuid(),
    parent_id       uuid references public.product_categories(id) on delete restrict,
    slug            text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 64),
    name            text not null check (length(name) between 2 and 80),
    display_order   integer not null default 0,
    created_at      timestamptz not null default now()
    );

comment on table public.product_categories is
  'Taxonomie Sente fixe pour catalogue produits. Hiérarchique 2 niveaux : '
  'catégories racines (parent_id IS NULL) + sous-catégories (parent_id pointe '
  'vers une racine). Un produit pointe toujours vers une sous-catégorie.';

create index if not exists idx_product_categories_parent
    on public.product_categories(parent_id, display_order);

-- Lecture publique : tout le monde peut voir la taxonomie (utilisée pour navigation boutique)
alter table public.product_categories enable row level security;

drop policy if exists "categories read public" on public.product_categories;
create policy "categories read public" on public.product_categories
  for select to anon, authenticated using (true);

-- Écriture admin uniquement (la taxonomie est figée par Sente, pas par les magasins)
drop policy if exists "categories admin all" on public.product_categories;
create policy "categories admin all" on public.product_categories
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- =============================================================================
-- 2. Seed des catégories Sente (10 racines + sous-catégories)
-- =============================================================================
-- Note : on utilise on conflict do nothing pour rendre la migration ré-exécutable.
-- Les UUIDs sont déterministes (pas de gen_random_uuid) pour faciliter les FK
-- en seed et permettre un re-seed sans casser les liens. On utilise des UUIDs v5
-- mais Postgres ne les génère pas natif — on hardcode des UUIDs choisis.

-- Catégories racines
insert into public.product_categories (id, parent_id, slug, name, display_order) values
                                                                                     ('00000000-0000-0000-0001-000000000001', null, 'cannes', 'Cannes', 10),
                                                                                     ('00000000-0000-0000-0001-000000000002', null, 'moulinets', 'Moulinets', 20),
                                                                                     ('00000000-0000-0000-0001-000000000003', null, 'lignes', 'Lignes & tresses', 30),
                                                                                     ('00000000-0000-0000-0001-000000000004', null, 'hamecons', 'Hameçons & montages', 40),
                                                                                     ('00000000-0000-0000-0001-000000000005', null, 'appats-amorces', 'Appâts & amorces', 50),
                                                                                     ('00000000-0000-0000-0001-000000000006', null, 'bouillettes', 'Bouillettes', 60),
                                                                                     ('00000000-0000-0000-0001-000000000007', null, 'vetements', 'Vêtements', 70),
                                                                                     ('00000000-0000-0000-0001-000000000008', null, 'accessoires', 'Accessoires', 80),
                                                                                     ('00000000-0000-0000-0001-000000000009', null, 'boites-valises', 'Boîtes & valises', 90),
                                                                                     ('00000000-0000-0000-0001-00000000000a', null, 'electronique', 'Électronique', 100)
    on conflict (id) do nothing;

-- Sous-catégories Cannes
insert into public.product_categories (id, parent_id, slug, name, display_order) values
                                                                                     ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', 'cannes-carpe', 'Cannes carpe', 10),
                                                                                     ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000001', 'cannes-silure', 'Cannes silure', 20),
                                                                                     ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000001', 'cannes-feeder', 'Cannes feeder', 30),
                                                                                     ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000001', 'cannes-mer', 'Cannes mer', 40),
                                                                                     ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000001', 'cannes-truite', 'Cannes truite', 50),
                                                                                     ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000001', 'cannes-spinning', 'Cannes spinning / lancer', 60),
                                                                                     ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000001', 'cannes-coup', 'Cannes au coup', 70),
                                                                                     ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-000000000001', 'cannes-mouche', 'Cannes mouche', 80)
    on conflict (id) do nothing;

-- Sous-catégories Moulinets
insert into public.product_categories (id, parent_id, slug, name, display_order) values
                                                                                     ('00000000-0000-0000-0002-000000000010', '00000000-0000-0000-0001-000000000002', 'moulinets-carpe', 'Moulinets carpe', 10),
                                                                                     ('00000000-0000-0000-0002-000000000011', '00000000-0000-0000-0001-000000000002', 'moulinets-spinning', 'Moulinets spinning', 20),
                                                                                     ('00000000-0000-0000-0002-000000000012', '00000000-0000-0000-0001-000000000002', 'moulinets-casting', 'Moulinets casting', 30),
                                                                                     ('00000000-0000-0000-0002-000000000013', '00000000-0000-0000-0001-000000000002', 'moulinets-mouche', 'Moulinets mouche', 40)
    on conflict (id) do nothing;

-- Sous-catégories Lignes
insert into public.product_categories (id, parent_id, slug, name, display_order) values
                                                                                     ('00000000-0000-0000-0002-000000000020', '00000000-0000-0000-0001-000000000003', 'lignes-nylon', 'Nylon', 10),
                                                                                     ('00000000-0000-0000-0002-000000000021', '00000000-0000-0000-0001-000000000003', 'lignes-fluorocarbone', 'Fluorocarbone', 20),
                                                                                     ('00000000-0000-0000-0002-000000000022', '00000000-0000-0000-0001-000000000003', 'lignes-tresse', 'Tresse', 30),
                                                                                     ('00000000-0000-0000-0002-000000000023', '00000000-0000-0000-0001-000000000003', 'lignes-bas-de-ligne', 'Bas de ligne', 40)
    on conflict (id) do nothing;

-- Sous-catégories Hameçons
insert into public.product_categories (id, parent_id, slug, name, display_order) values
                                                                                     ('00000000-0000-0000-0002-000000000030', '00000000-0000-0000-0001-000000000004', 'hamecons-carpe', 'Hameçons carpe', 10),
                                                                                     ('00000000-0000-0000-0002-000000000031', '00000000-0000-0000-0001-000000000004', 'hamecons-mer', 'Hameçons mer', 20),
                                                                                     ('00000000-0000-0000-0002-000000000032', '00000000-0000-0000-0001-000000000004', 'hamecons-coup', 'Hameçons au coup', 30),
                                                                                     ('00000000-0000-0000-0002-000000000033', '00000000-0000-0000-0001-000000000004', 'hamecons-mouches', 'Mouches montées', 40),
                                                                                     ('00000000-0000-0000-0002-000000000034', '00000000-0000-0000-0001-000000000004', 'hamecons-leurres', 'Leurres', 50)
    on conflict (id) do nothing;

-- Sous-catégories Appâts & amorces
insert into public.product_categories (id, parent_id, slug, name, display_order) values
                                                                                     ('00000000-0000-0000-0002-000000000040', '00000000-0000-0000-0001-000000000005', 'appats-naturels', 'Appâts naturels', 10),
                                                                                     ('00000000-0000-0000-0002-000000000041', '00000000-0000-0000-0001-000000000005', 'appats-amorces-coup', 'Amorces au coup', 20),
                                                                                     ('00000000-0000-0000-0002-000000000042', '00000000-0000-0000-0001-000000000005', 'appats-pellets', 'Pellets', 30),
                                                                                     ('00000000-0000-0000-0002-000000000043', '00000000-0000-0000-0001-000000000005', 'appats-graines', 'Graines & particules', 40),
                                                                                     ('00000000-0000-0000-0002-000000000044', '00000000-0000-0000-0001-000000000005', 'appats-additifs', 'Additifs & arômes', 50)
    on conflict (id) do nothing;

-- Sous-catégories Bouillettes
insert into public.product_categories (id, parent_id, slug, name, display_order) values
                                                                                     ('00000000-0000-0000-0002-000000000050', '00000000-0000-0000-0001-000000000006', 'bouillettes-eclate', 'Bouillettes éclatées / pop-up', 10),
                                                                                     ('00000000-0000-0000-0002-000000000051', '00000000-0000-0000-0001-000000000006', 'bouillettes-cuites', 'Bouillettes cuites', 20),
                                                                                     ('00000000-0000-0000-0002-000000000052', '00000000-0000-0000-0001-000000000006', 'bouillettes-dips-glug', 'Dips & glugs', 30),
                                                                                     ('00000000-0000-0000-0002-000000000053', '00000000-0000-0000-0001-000000000006', 'bouillettes-mix-base', 'Mix de base', 40)
    on conflict (id) do nothing;

-- Sous-catégories Vêtements
insert into public.product_categories (id, parent_id, slug, name, display_order) values
                                                                                     ('00000000-0000-0000-0002-000000000060', '00000000-0000-0000-0001-000000000007', 'vetements-vestes', 'Vestes & manteaux', 10),
                                                                                     ('00000000-0000-0000-0002-000000000061', '00000000-0000-0000-0001-000000000007', 'vetements-pantalons', 'Pantalons & combinaisons', 20),
                                                                                     ('00000000-0000-0000-0002-000000000062', '00000000-0000-0000-0001-000000000007', 'vetements-bottes-waders', 'Bottes & waders', 30),
                                                                                     ('00000000-0000-0000-0002-000000000063', '00000000-0000-0000-0001-000000000007', 'vetements-tshirts-pulls', 'T-shirts & pulls', 40),
                                                                                     ('00000000-0000-0000-0002-000000000064', '00000000-0000-0000-0001-000000000007', 'vetements-casquettes-bonnets', 'Casquettes & bonnets', 50),
                                                                                     ('00000000-0000-0000-0002-000000000065', '00000000-0000-0000-0001-000000000007', 'vetements-gants', 'Gants', 60)
    on conflict (id) do nothing;

-- Sous-catégories Accessoires
insert into public.product_categories (id, parent_id, slug, name, display_order) values
                                                                                     ('00000000-0000-0000-0002-000000000070', '00000000-0000-0000-0001-000000000008', 'accessoires-epuisettes', 'Épuisettes', 10),
                                                                                     ('00000000-0000-0000-0002-000000000071', '00000000-0000-0000-0001-000000000008', 'accessoires-tapis-receptions', 'Tapis de réception', 20),
                                                                                     ('00000000-0000-0000-0002-000000000072', '00000000-0000-0000-0001-000000000008', 'accessoires-rod-pods', 'Rod pods & supports', 30),
                                                                                     ('00000000-0000-0000-0002-000000000073', '00000000-0000-0000-0001-000000000008', 'accessoires-detecteurs', 'Détecteurs & écouteurs', 40),
                                                                                     ('00000000-0000-0000-0002-000000000074', '00000000-0000-0000-0001-000000000008', 'accessoires-bivvy-tentes', 'Bivvies & tentes', 50),
                                                                                     ('00000000-0000-0000-0002-000000000075', '00000000-0000-0000-0001-000000000008', 'accessoires-bedchairs', 'Bedchairs & sacs de couchage', 60),
                                                                                     ('00000000-0000-0000-0002-000000000076', '00000000-0000-0000-0001-000000000008', 'accessoires-eclairage', 'Éclairage', 70),
                                                                                     ('00000000-0000-0000-0002-000000000077', '00000000-0000-0000-0001-000000000008', 'accessoires-divers', 'Divers', 80)
    on conflict (id) do nothing;

-- Sous-catégories Boîtes & valises
insert into public.product_categories (id, parent_id, slug, name, display_order) values
                                                                                     ('00000000-0000-0000-0002-000000000080', '00000000-0000-0000-0001-000000000009', 'boites-rangement', 'Boîtes de rangement', 10),
                                                                                     ('00000000-0000-0000-0002-000000000081', '00000000-0000-0000-0001-000000000009', 'boites-valises-transport', 'Valises de transport', 20),
                                                                                     ('00000000-0000-0000-0002-000000000082', '00000000-0000-0000-0001-000000000009', 'boites-fourreaux', 'Fourreaux & housses cannes', 30),
                                                                                     ('00000000-0000-0000-0002-000000000083', '00000000-0000-0000-0001-000000000009', 'boites-sacs', 'Sacs & carryalls', 40)
    on conflict (id) do nothing;

-- Sous-catégories Électronique
insert into public.product_categories (id, parent_id, slug, name, display_order) values
                                                                                     ('00000000-0000-0000-0002-000000000090', '00000000-0000-0000-0001-00000000000a', 'electronique-sondeurs', 'Sondeurs & échosondeurs', 10),
                                                                                     ('00000000-0000-0000-0002-000000000091', '00000000-0000-0000-0001-00000000000a', 'electronique-bateaux-amorceurs', 'Bateaux amorceurs', 20),
                                                                                     ('00000000-0000-0000-0002-000000000092', '00000000-0000-0000-0001-00000000000a', 'electronique-cameras', 'Caméras subaquatiques', 30),
                                                                                     ('00000000-0000-0000-0002-000000000093', '00000000-0000-0000-0001-00000000000a', 'electronique-gps-batteries', 'GPS & batteries', 40)
    on conflict (id) do nothing;

-- Contrainte : un parent doit être une racine (parent_id IS NULL pour le parent)
-- Implémentée via fonction de vérification déclenchée à l'insert/update
create or replace function public.fn_check_category_depth()
returns trigger
language plpgsql
as $$
declare
v_parent_parent uuid;
begin
  if new.parent_id is null then
    return new; -- racine, OK
end if;

  -- Le parent ne doit pas avoir lui-même un parent (max 2 niveaux)
select parent_id into v_parent_parent
from public.product_categories
where id = new.parent_id;

if v_parent_parent is not null then
    raise exception 'Profondeur catégorie max = 2 (parent_id pointe vers une racine uniquement)'
      using errcode = '23514';
end if;

return new;
end;
$$;

drop trigger if exists tg_product_categories_check_depth on public.product_categories;
create trigger tg_product_categories_check_depth
    before insert or update on public.product_categories
                         for each row execute function public.fn_check_category_depth();


-- =============================================================================
-- 3. Configuration boutique par magasin (frais de livraison)
-- =============================================================================
-- Chaque magasin configure ses modes de livraison + frais.
-- Modes possibles : click_collect (toujours offert), shipping_standard, shipping_local.
-- Si un mode n'est pas activé, le magasin ne le propose pas.

create table if not exists public.shop_settings (
                                                    organization_id           uuid primary key references public.organizations(id) on delete cascade,
    -- Click & collect : toujours possible si activé, gratuit par définition
    click_collect_enabled     boolean not null default true,
    -- Livraison standard (poste, GLS, etc.) : magasin saisit son forfait
    shipping_standard_enabled boolean not null default false,
    shipping_standard_fee_cents integer not null default 0
    check (shipping_standard_fee_cents >= 0 and shipping_standard_fee_cents <= 10000),
    -- Livraison locale (le magasin livre lui-même dans sa zone)
    shipping_local_enabled    boolean not null default false,
    shipping_local_fee_cents  integer not null default 0
    check (shipping_local_fee_cents >= 0 and shipping_local_fee_cents <= 10000),
    shipping_local_zone_desc  text
    check (shipping_local_zone_desc is null or length(shipping_local_zone_desc) <= 200),
    -- Métadonnées
    created_at                timestamptz not null default now(),
    updated_at                timestamptz not null default now()
    );

comment on table public.shop_settings is
  'Configuration de la boutique d''un magasin : modes de livraison et frais. '
  'Une ligne par magasin (1:1 avec organizations). Click&collect toujours gratuit.';
comment on column public.shop_settings.shipping_local_zone_desc is
  'Description libre de la zone de livraison locale (ex: "Mons + 30 km"). Affiché au pêcheur.';

drop trigger if exists tg_shop_settings_updated_at on public.shop_settings;
create trigger tg_shop_settings_updated_at
    before update on public.shop_settings
    for each row execute function public.tg_set_updated_at();

alter table public.shop_settings enable row level security;
alter table public.shop_settings force row level security;

-- Lecture publique : les pêcheurs voient les frais avant le checkout
drop policy if exists "shop_settings read public" on public.shop_settings;
create policy "shop_settings read public" on public.shop_settings
  for select to anon, authenticated using (true);

-- Écriture : owner/admin du magasin
drop policy if exists "shop_settings write owner_admin" on public.shop_settings;
create policy "shop_settings write owner_admin" on public.shop_settings
  for all to authenticated
  using (public.is_org_owner_or_admin(organization_id))
  with check (public.is_org_owner_or_admin(organization_id));

drop policy if exists "shop_settings admin all" on public.shop_settings;
create policy "shop_settings admin all" on public.shop_settings
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());


-- =============================================================================
-- 4. Produits
-- =============================================================================
-- Un produit appartient à un magasin (org_type='magasin'), a une catégorie (niveau 2),
-- des photos, un slug unique par magasin, un statut (draft / published / archived).
-- Les variantes (au moins 1) portent le SKU/prix/stock effectif.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'product_status') then
create type product_status as enum ('draft', 'published', 'archived');
end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'product_kind') then
    -- Pour V1.5 : 'physical' uniquement. 'gift_card' et 'subscription_box' arriveront en 0022/0023.
create type product_kind as enum ('physical', 'gift_card', 'subscription_box');
end if;
end$$;

create table if not exists public.products (
                                               id              uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    category_id     uuid not null references public.product_categories(id) on delete restrict,
    kind            product_kind not null default 'physical',
    status          product_status not null default 'draft',
    -- Slug unique par magasin (URL: /magasins/[mag-slug]/boutique/[product-slug])
    slug            text not null
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 100),
    name            text not null check (length(name) between 2 and 150),
    short_desc      text check (short_desc is null or length(short_desc) <= 250),
    full_desc       text check (full_desc is null or length(full_desc) <= 8000),
    brand           text check (brand is null or length(brand) <= 80),
    -- Photos : array d'URLs R2 (1 à 8 photos), la première = principale
    photos          text[] not null default '{}'::text[]
    check (cardinality(photos) <= 8),
    -- Tags libres (en complément de la catégorie)
    tags            text[] not null default '{}'::text[]
    check (cardinality(tags) <= 10),
    -- Dimensions actives pour les variantes (max 3) : ex ['Taille', 'Couleur']
    -- Si vide, le produit n'a qu'une variante "default"
    variant_dimensions text[] not null default '{}'::text[]
    check (cardinality(variant_dimensions) <= 3),
    -- Métadonnées
    published_at    timestamptz,
    deleted_at      timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    -- Slug unique par organisation (pas global)
    unique (organization_id, slug)
    );

comment on table public.products is
  'Catalogue produits des magasins. Un produit a au moins 1 variante (product_variants). '
  'Le statut draft permet de préparer un produit avant publication. Soft delete via deleted_at.';
comment on column public.products.variant_dimensions is
  'Liste des dimensions de variation (ex: [Taille, Couleur]). Max 3. Si vide, '
  'le produit a une seule variante avec options vides.';
comment on column public.products.photos is
  'URLs R2 des photos. La première est l''image principale affichée en card. Max 8.';

create index if not exists idx_products_org_status
    on public.products(organization_id, status, published_at desc)
    where deleted_at is null;

create index if not exists idx_products_category_published
    on public.products(category_id, published_at desc)
    where status = 'published' and deleted_at is null;

create index if not exists idx_products_search_name
    on public.products using gin (name gin_trgm_ops)
    where status = 'published' and deleted_at is null;

drop trigger if exists tg_products_updated_at on public.products;
create trigger tg_products_updated_at
    before update on public.products
    for each row execute function public.tg_set_updated_at();

-- =============================================================================
-- 5. Variantes produits
-- =============================================================================
-- Chaque variante a son SKU, prix, stock, et options (mapping dimension → valeur).
-- Une variante "default" est créée auto si le produit n'a pas de dimensions.

create table if not exists public.product_variants (
                                                       id              uuid primary key default gen_random_uuid(),
    product_id      uuid not null references public.products(id) on delete cascade,
    sku             text not null check (length(sku) between 1 and 64),
    -- Prix TTC en cents (toujours positif, max 100k€)
    price_cents     integer not null check (price_cents > 0 and price_cents <= 10000000),
    -- Prix barré (optionnel, pour afficher "promo")
    compare_at_price_cents integer
    check (compare_at_price_cents is null or (compare_at_price_cents > 0 and compare_at_price_cents <= 10000000)),
    -- Stock : NULL = illimité (utile pour bons cadeaux), 0 = rupture, >0 = disponible
    stock_quantity  integer
    check (stock_quantity is null or stock_quantity >= 0),
    -- Options : mapping dimension → valeur (ex: {"Taille": "12ft", "Puissance": "3lb"})
    -- Doit avoir exactement les mêmes clés que products.variant_dimensions
    options         jsonb not null default '{}'::jsonb,
    -- Position d'affichage (le magasin peut réordonner)
    display_order   integer not null default 0,
    -- Métadonnées
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    -- SKU unique par magasin (via produit) : on enforce via index partiel ci-dessous
    unique (product_id, sku)
    );

comment on table public.product_variants is
  'Variantes d''un produit avec SKU, prix, stock et options. Un produit a au '
  'moins une variante. stock_quantity=NULL = illimité (bons cadeaux), 0 = rupture.';
comment on column public.product_variants.options is
  'Mapping {dimension: valeur} ex: {"Taille": "12ft"}. Clés doivent matcher '
  'products.variant_dimensions. Si dimensions vide, options = {}.';

create index if not exists idx_variants_product_active
    on public.product_variants(product_id, display_order)
    where is_active = true;

-- =============================================================================
-- Unicité du SKU par magasin (enforce via trigger, pas via index)
-- =============================================================================
-- Postgres n'autorise pas les subqueries dans les définitions d'index.
-- On utilise donc un trigger BEFORE INSERT/UPDATE qui vérifie l'unicité
-- du couple (organization_id du produit, sku) parmi les variantes actives.
--
-- Pourquoi : permet aux magasins d'avoir un référentiel SKU cohérent à travers
-- tout leur catalogue (utile pour intégration ERP/facturation future).
-- L'unicité par produit est déjà garantie par la contrainte UNIQUE (product_id, sku).
-- =============================================================================

create or replace function public.fn_check_variant_sku_unique_per_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_org_id uuid;
  v_conflict_count integer;
begin
  -- Optim : on skip la vérif si la variante est inactive (pas dans le scope d'unicité)
  -- ou si le SKU n'a pas changé (cas update sur d'autres colonnes)
  if new.is_active = false then
    return new;
end if;

  if tg_op = 'UPDATE' and old.sku = new.sku and old.is_active = new.is_active then
    return new;
end if;

  -- Récupère l'org_id du produit parent
select organization_id into v_org_id
from public.products
where id = new.product_id;

if v_org_id is null then
    raise exception 'Produit parent introuvable' using errcode = '23503';
end if;

  -- Cherche un conflit : autre variante active du même magasin avec le même SKU
select count(*) into v_conflict_count
from public.product_variants v
         join public.products p on p.id = v.product_id
where p.organization_id = v_org_id
  and v.sku = new.sku
  and v.is_active = true
  and v.id <> new.id;  -- exclut la ligne en cours d'update

if v_conflict_count > 0 then
    raise exception 'SKU "%" déjà utilisé dans ton catalogue. Choisis un SKU unique.', new.sku
      using errcode = '23505';
end if;

return new;
end;
$$;

comment on function public.fn_check_variant_sku_unique_per_org() is
  'Vérifie que le SKU d''une variante active est unique au sein du magasin '
  '(toutes variantes actives confondues, pas seulement par produit).';

drop trigger if exists tg_product_variants_sku_unique on public.product_variants;
create trigger tg_product_variants_sku_unique
    before insert or update of sku, is_active, product_id on public.product_variants
    for each row execute function public.fn_check_variant_sku_unique_per_org();

drop trigger if exists tg_product_variants_updated_at on public.product_variants;
create trigger tg_product_variants_updated_at
    before update on public.product_variants
    for each row execute function public.tg_set_updated_at();

-- =============================================================================
-- 6. RLS produits + variantes
-- =============================================================================
alter table public.products enable row level security;
alter table public.products force row level security;

-- Lecture publique : produits publiés et non supprimés
drop policy if exists "products read published" on public.products;
create policy "products read published" on public.products
  for select to anon, authenticated
                      using (status = 'published' and deleted_at is null);

-- Lecture par membres de l'org : tous les produits (incluant draft)
drop policy if exists "products read members" on public.products;
create policy "products read members" on public.products
  for select to authenticated
                      using (public.is_org_member(organization_id) and deleted_at is null);

-- Insertion : owner/admin/staff de l'org (le staff peut créer des produits)
drop policy if exists "products insert org" on public.products;
create policy "products insert org" on public.products
  for insert to authenticated
  with check (public.is_org_member(organization_id));

-- Update : owner/admin/staff
drop policy if exists "products update org" on public.products;
create policy "products update org" on public.products
  for update to authenticated
                                  using (public.is_org_member(organization_id))
      with check (public.is_org_member(organization_id));

-- Soft delete via update (pas de DELETE direct)
-- (Le hard delete est fait par admin uniquement)

drop policy if exists "products admin all" on public.products;
create policy "products admin all" on public.products
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());


alter table public.product_variants enable row level security;
alter table public.product_variants force row level security;

-- Lecture publique : variantes des produits publiés
drop policy if exists "variants read published" on public.product_variants;
create policy "variants read published" on public.product_variants
  for select to anon, authenticated
                      using (
                      is_active = true and exists (
                      select 1 from public.products p
                      where p.id = product_id
                      and p.status = 'published'
                      and p.deleted_at is null
                      )
                      );

-- Lecture membres org : toutes les variantes du produit (incluant inactives)
drop policy if exists "variants read members" on public.product_variants;
create policy "variants read members" on public.product_variants
  for select to authenticated
                      using (
                      exists (
                      select 1 from public.products p
                      where p.id = product_id
                      and public.is_org_member(p.organization_id)
                      and p.deleted_at is null
                      )
                      );

-- Insert/update : membres de l'org du produit
drop policy if exists "variants insert org" on public.product_variants;
create policy "variants insert org" on public.product_variants
  for insert to authenticated
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and public.is_org_member(p.organization_id)
    )
  );

drop policy if exists "variants update org" on public.product_variants;
create policy "variants update org" on public.product_variants
  for update to authenticated
                                  using (
                                  exists (
                                  select 1 from public.products p
                                  where p.id = product_id
                                  and public.is_org_member(p.organization_id)
                                  )
                                  )
      with check (
                                  exists (
                                  select 1 from public.products p
                                  where p.id = product_id
                                  and public.is_org_member(p.organization_id)
                                  )
                                  );

drop policy if exists "variants delete org" on public.product_variants;
create policy "variants delete org" on public.product_variants
  for delete to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and public.is_org_member(p.organization_id)
    )
  );

drop policy if exists "variants admin all" on public.product_variants;
create policy "variants admin all" on public.product_variants
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- =============================================================================
-- 7. RPCs : opérations atomiques produits
-- =============================================================================

-- 7.1 Créer un produit avec sa variante par défaut (workflow étape 1)
create or replace function public.create_product_draft(
  p_organization_id uuid,
  p_category_id     uuid,
  p_name            text,
  p_short_desc      text,
  p_brand           text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id    uuid;
  v_org_type   text;
  v_product_id uuid;
  v_slug       text;
  v_base_slug  text;
  v_counter    integer := 0;
  v_category_parent uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  -- L'utilisateur doit être membre de l'org
  if not public.is_org_member(p_organization_id) then
    raise exception 'Tu n''es pas membre de cette organisation' using errcode = '42501';
end if;

  -- L'org doit être un magasin
select org_type into v_org_type from public.organizations where id = p_organization_id;
if v_org_type <> 'magasin' then
    raise exception 'Seuls les magasins peuvent créer des produits' using errcode = '23514';
end if;

  -- La catégorie doit être de niveau 2 (avoir un parent)
select parent_id into v_category_parent from public.product_categories where id = p_category_id;
if v_category_parent is null then
    raise exception 'Choisis une sous-catégorie (pas une catégorie racine)' using errcode = '23514';
end if;

  -- Validation nom
  if p_name is null or length(trim(p_name)) < 2 or length(p_name) > 150 then
    raise exception 'Nom invalide (2-150 caractères)' using errcode = '23514';
end if;

  -- Génère un slug unique par org à partir du nom
  v_base_slug := public.fn_slugify(p_name);
  v_slug := v_base_slug;
  while exists (
    select 1 from public.products
    where organization_id = p_organization_id and slug = v_slug
  ) loop
    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter::text;
    if v_counter > 100 then
      raise exception 'Impossible de générer un slug unique' using errcode = 'P0001';
end if;
end loop;

  -- Crée le produit en draft
insert into public.products (
    organization_id, category_id, kind, status, slug, name, short_desc, brand
)
values (
           p_organization_id, p_category_id, 'physical', 'draft', v_slug,
           trim(p_name),
           nullif(trim(coalesce(p_short_desc, '')), ''),
           nullif(trim(coalesce(p_brand, '')), '')
       )
    returning id into v_product_id;

-- Crée la variante par défaut (sans options, prix 0 pour forcer édition étape 4)
insert into public.product_variants (
    product_id, sku, price_cents, stock_quantity, options, display_order
)
values (
           v_product_id,
           'SKU-' || substring(v_product_id::text from 1 for 8),
           100, -- 1€ minimum pour passer la check, sera édité étape 4
           0,   -- stock 0 par défaut
           '{}'::jsonb,
           0
       );

-- Audit
insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id, 'product.create', 'product', v_product_id,
           jsonb_build_object(
                   'organization_id', p_organization_id,
                   'name', p_name,
                   'slug', v_slug
           )
       );

return v_product_id;
end;
$$;
revoke execute on function public.create_product_draft(uuid, uuid, text, text, text) from public;
grant execute on function public.create_product_draft(uuid, uuid, text, text, text) to authenticated;

-- 7.2 Helper : slugifier une chaîne
create or replace function public.fn_slugify(p_text text)
returns text
language plpgsql
immutable
as $$
declare
v_result text;
begin
  -- Lowercase + remplace accents
  v_result := lower(p_text);
  v_result := translate(v_result,
    'àáâãäåèéêëìíîïòóôõöùúûüýÿñç',
    'aaaaaaeeeeiiiiooooouuuuyync'
  );
  -- Garde uniquement [a-z0-9-]
  v_result := regexp_replace(v_result, '[^a-z0-9]+', '-', 'g');
  -- Trim tirets
  v_result := trim(both '-' from v_result);
  -- Tronque à 80 chars
  v_result := substring(v_result from 1 for 80);
  v_result := trim(both '-' from v_result);
  -- Si vide, fallback
  if v_result = '' or v_result is null then
    v_result := 'produit';
end if;
return v_result;
end;
$$;

-- 7.3 Publier un produit (transition draft → published, avec validations)
create or replace function public.publish_product(
  p_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id   uuid;
  v_org_id    uuid;
  v_status    product_status;
  v_photos_count integer;
  v_variants_count integer;
  v_min_price integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

select organization_id, status, cardinality(photos)
into v_org_id, v_status, v_photos_count
from public.products
where id = p_product_id and deleted_at is null;

if v_org_id is null then
    raise exception 'Produit introuvable' using errcode = '42P01';
end if;

  if not public.is_org_member(v_org_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

  if v_status = 'published' then
    return; -- déjà publié, idempotent
end if;

  if v_status = 'archived' then
    raise exception 'Produit archivé. Réactive-le avant de publier.' using errcode = '23514';
end if;

  -- Validations métier avant publication
  if v_photos_count = 0 then
    raise exception 'Ajoute au moins une photo avant de publier' using errcode = '23514';
end if;

  -- Au moins une variante active avec prix > 100 cents (1€ = placeholder de la création)
select count(*), min(price_cents) into v_variants_count, v_min_price
from public.product_variants
where product_id = p_product_id and is_active = true;

if v_variants_count = 0 then
    raise exception 'Aucune variante active' using errcode = '23514';
end if;

  if v_min_price <= 100 then
    raise exception 'Renseigne un prix réel (>1€) sur tes variantes avant de publier'
      using errcode = '23514';
end if;

update public.products
set status = 'published',
    published_at = coalesce(published_at, now()),
    updated_at = now()
where id = p_product_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (v_user_id, 'product.publish', 'product', p_product_id, '{}'::jsonb);
end;
$$;
revoke execute on function public.publish_product(uuid) from public;
grant execute on function public.publish_product(uuid) to authenticated;

-- 7.4 Soft delete d'un produit
create or replace function public.soft_delete_product(
  p_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id uuid;
  v_org_id  uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

select organization_id into v_org_id
from public.products
where id = p_product_id and deleted_at is null;

if v_org_id is null then
    raise exception 'Produit introuvable' using errcode = '42P01';
end if;

  if not public.is_org_member(v_org_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

update public.products
set deleted_at = now(),
    status = 'archived',
    updated_at = now()
where id = p_product_id;

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (v_user_id, 'product.delete', 'product', p_product_id, '{}'::jsonb);
end;
$$;
revoke execute on function public.soft_delete_product(uuid) from public;
grant execute on function public.soft_delete_product(uuid) to authenticated;

-- =============================================================================
-- Fin de la migration 0020
-- =============================================================================