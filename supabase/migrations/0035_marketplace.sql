-- =============================================================================
-- Migration 0035 — Marketplace C2C particuliers ("Vinted de la pêche")
-- =============================================================================
-- 14 nouvelles tables, 11 nouveaux enums, 6 helpers SQL, 7 triggers métier
-- Extensions : payments.kind (+ c2c_escrow, c2c_boost), report_target
-- (+ listing, marketplace_message, marketplace_review)
--
-- Ne contient PAS les RLS — voir 0036_marketplace_c2c_rls.sql
-- Ne contient PAS le seed taxonomie — voir seed_marketplace_taxonomy.sql
-- =============================================================================


-- =============================================================================
-- 1. Extensions des enums et contraintes existants
-- =============================================================================

-- Étendre payments.kind pour les nouveaux types de paiement marketplace
-- c2c_escrow : paiement initial buyer→Sente (hold avant release vendeur)
-- c2c_boost  : paiement one-shot pour boost listing (feed_bump, featured, etc.)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_kind_check;
ALTER TABLE payments ADD CONSTRAINT payments_kind_check
    CHECK (kind = ANY (ARRAY[
                           'etang_subscription'::text,
                       'order'::text,
                       'event_registration'::text,
                       'platform_fee'::text,
                       'refund'::text,
                       'c2c_escrow'::text,
                       'c2c_boost'::text
  ]));

-- Étendre report_target pour les signalements marketplace
-- (l'enum existe déjà, on ajoute des valeurs)
ALTER TYPE report_target ADD VALUE IF NOT EXISTS 'listing';
ALTER TYPE report_target ADD VALUE IF NOT EXISTS 'marketplace_message';
ALTER TYPE report_target ADD VALUE IF NOT EXISTS 'marketplace_review';


-- =============================================================================
-- 2. Nouveaux enums marketplace
-- =============================================================================

-- Cycle de vie d'une annonce
CREATE TYPE marketplace_listing_status AS ENUM (
  'draft',           -- brouillon vendeur
  'pending_review',  -- 1ère annonce d'un nouveau vendeur, attente modération
  'active',          -- publiée, visible, achetable
  'reserved',        -- bloquée 5 min pendant un checkout
  'sold',            -- vendue, order créé
  'expired',         -- 60j sans activité, renouvelable
  'removed'          -- retirée par vendeur ou admin
);

-- État de l'article (échelle Vinted-like + neuf avec étiquette)
CREATE TYPE marketplace_listing_condition AS ENUM (
  'new_with_tag',  -- neuf avec étiquette
  'new',           -- neuf sans étiquette
  'very_good',     -- très bon état
  'good',          -- bon état
  'acceptable'     -- correct
);

-- Statut d'une offre / négociation prix
CREATE TYPE marketplace_offer_status AS ENUM (
  'pending',    -- en attente réponse vendeur
  'accepted',   -- acceptée → déclenche checkout
  'rejected',   -- refusée
  'countered',  -- contre-offre faite (offre actuelle close, nouvelle créée avec parent_offer_id)
  'expired',    -- TTL 48h dépassé
  'cancelled'   -- annulée par buyer ou par sale du listing
);

-- Cycle de vie d'un order C2C (escrow + livraison)
CREATE TYPE marketplace_order_status AS ENUM (
  'pending_payment',         -- créé, attente confirmation Stripe
  'paid_awaiting_shipment',  -- payé, vendeur doit générer label
  'shipped',                 -- label généré, colis en transit
  'delivered',               -- carrier confirme livraison, démarre fenêtre 2j
  'released',                -- transfer Stripe vers vendeur effectué
  'closed',                  -- finalisé, reviews ouvertes
  'cancelled',               -- annulé avant expédition
  'disputed',                -- litige ouvert, release bloqué
  'refunded'                 -- refund total effectué
);

-- Statut KYC du compte vendeur (Stripe Connect Express)
CREATE TYPE marketplace_kyc_status AS ENUM (
  'not_started',  -- pas encore engagé
  'pending',      -- onboarding en cours côté Stripe
  'verified',     -- KYC validé, peut vendre
  'rejected',     -- KYC refusé par Stripe
  'restricted'    -- restreint (sanctions, fraude détectée)
);

-- Raison d'ouverture de litige
CREATE TYPE marketplace_dispute_reason AS ENUM (
  'not_received',        -- pas reçu malgré tracking livré
  'not_as_described',    -- ne correspond pas à l'annonce
  'damaged',             -- endommagé à l'arrivée
  'other'
);

-- État d'un litige
CREATE TYPE marketplace_dispute_status AS ENUM (
  'open',              -- ouvert par buyer
  'in_review',         -- pris en charge par admin
  'resolved_buyer',    -- résolu en faveur de l'acheteur (refund)
  'resolved_seller',   -- résolu en faveur du vendeur (release)
  'resolved_partial'   -- résolution partielle (refund + release partagé)
);

-- Rôle du noteur dans une review bidirectionnelle
CREATE TYPE marketplace_review_role AS ENUM ('buyer', 'seller');

-- Carriers supportés en MVP
CREATE TYPE marketplace_carrier AS ENUM ('mondial_relay', 'colissimo');

-- Types de boost achetables
CREATE TYPE marketplace_boost_kind AS ENUM (
  'feed_bump',      -- 7j en tête du fil marketplace
  'featured_home',  -- 24h en encart "À la une" sur l'accueil
  'category_top'    -- 7j en tête de catégorie
);

-- État d'un boost (active / expired par cron / cancelled si refund)
CREATE TYPE marketplace_boost_status AS ENUM ('active', 'expired', 'cancelled');


-- =============================================================================
-- 3. marketplace_seller_accounts
-- =============================================================================
-- Compte vendeur particulier : Stripe Connect Express (individual) + DAC7
-- 1 ligne par user qui a engagé le KYC (pas tous les pêcheurs)
-- =============================================================================
CREATE TABLE marketplace_seller_accounts (
                                             user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

    -- Stripe Connect Express (compte type 'individual')
                                             stripe_account_id text UNIQUE
                                                 CHECK (stripe_account_id IS NULL OR stripe_account_id ~ '^acct_'),
  stripe_charges_enabled boolean NOT NULL DEFAULT false,
  stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  stripe_details_submitted boolean NOT NULL DEFAULT false,

  -- État KYC
  kyc_status marketplace_kyc_status NOT NULL DEFAULT 'not_started',
  kyc_completed_at timestamptz,
  restricted_reason text
    CHECK (restricted_reason IS NULL OR length(restricted_reason) <= 500),

  -- DAC7 — directive EU de déclaration fiscale des plateformes
  -- Champs obligatoires une fois kyc_status = 'verified' (CHECK ci-dessous)
  dac7_legal_first_name text
    CHECK (dac7_legal_first_name IS NULL OR length(dac7_legal_first_name) <= 100),
  dac7_legal_last_name text
    CHECK (dac7_legal_last_name IS NULL OR length(dac7_legal_last_name) <= 100),
  dac7_birth_date date,
  dac7_country_residence country_code,  -- réutilise enum existant (BE, FR, ...)
  dac7_address_full text
    CHECK (dac7_address_full IS NULL OR length(dac7_address_full) <= 500),
  dac7_tin text  -- numéro fiscal (NN belge, numéro fiscal français)
    CHECK (dac7_tin IS NULL OR length(dac7_tin) <= 50),
  dac7_verified_at timestamptz,

  -- Compteurs YTD pour seuils DAC7 (30 ventes OU 2000€/an déclencheurs reporting)
  -- Reset par cron quotidien si l'année courante diffère de ytd_year
  ytd_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer
    CHECK (ytd_year >= 2025 AND ytd_year <= 2100),
  sales_count_ytd integer NOT NULL DEFAULT 0
    CHECK (sales_count_ytd >= 0),
  sales_amount_cents_ytd integer NOT NULL DEFAULT 0
    CHECK (sales_amount_cents_ytd >= 0),

  -- Acceptation conditions vendeur (CGU spécifiques C2C, distinctes des CGU générales)
  vendor_terms_accepted_at timestamptz,
  vendor_terms_version text
    CHECK (vendor_terms_version IS NULL OR length(vendor_terms_version) <= 20),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Garde-fou : si verified, tous les champs DAC7 doivent être remplis
  CONSTRAINT chk_seller_kyc_dac7_complete CHECK (
    kyc_status != 'verified' OR (
      dac7_legal_first_name IS NOT NULL AND
      dac7_legal_last_name IS NOT NULL AND
      dac7_birth_date IS NOT NULL AND
      dac7_country_residence IS NOT NULL AND
      dac7_address_full IS NOT NULL AND
      dac7_tin IS NOT NULL AND
      stripe_account_id IS NOT NULL AND
      stripe_charges_enabled = true AND
      stripe_payouts_enabled = true
    )
  )
);

CREATE INDEX idx_marketplace_seller_accounts_kyc_status
    ON marketplace_seller_accounts(kyc_status)
    WHERE kyc_status != 'verified';

CREATE INDEX idx_marketplace_seller_accounts_dac7_threshold
    ON marketplace_seller_accounts(user_id)
    WHERE sales_count_ytd >= 30 OR sales_amount_cents_ytd >= 200000;

COMMENT ON TABLE marketplace_seller_accounts IS
  'Compte vendeur particulier marketplace : Stripe Connect Express + collecte DAC7';


-- =============================================================================
-- 4. marketplace_categories — taxonomie hiérarchique 2 niveaux
-- =============================================================================
-- N1 : famille (Cannes, Moulinets, Leurres, ...)
-- N2 : discipline (carpe, coup, feeder, ...) uniquement sous Cannes/Moulinets/
--      Leurres/Détection. Le seed initial peuple la hiérarchie complète.
-- =============================================================================
CREATE TABLE marketplace_categories (
                                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                        parent_id uuid REFERENCES marketplace_categories(id) ON DELETE RESTRICT,
                                        slug text UNIQUE NOT NULL CHECK (is_valid_slug(slug)),
                                        name_fr text NOT NULL CHECK (length(name_fr) >= 2 AND length(name_fr) <= 80),
                                        sort_order integer NOT NULL DEFAULT 0,
                                        created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_categories_parent
    ON marketplace_categories(parent_id, sort_order);


-- =============================================================================
-- 5. marketplace_brands — marques pêche
-- =============================================================================
-- Verified=true : marque référencée admin. Verified=false : proposée par vendeur,
-- en attente validation. Listings utilisant une brand non verified passent en
-- pending_review jusqu'à validation admin de la marque.
-- =============================================================================
CREATE TABLE marketplace_brands (
                                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                    slug text UNIQUE NOT NULL CHECK (is_valid_slug(slug)),
                                    name text NOT NULL CHECK (length(name) >= 2 AND length(name) <= 80),
                                    verified boolean NOT NULL DEFAULT false,
                                    created_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
                                    created_at timestamptz NOT NULL DEFAULT now(),
                                    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_brands_verified
    ON marketplace_brands(verified, name)
    WHERE verified = true;

CREATE INDEX idx_marketplace_brands_name_lower
    ON marketplace_brands(lower(name));


-- =============================================================================
-- 6. marketplace_listings — table centrale des annonces
-- =============================================================================
-- Toutes les attributs spécifiques pêche (longueur canne, latéralité moulinet,
-- ratio, type leurre, etc.) vont dans `attributes` JSONB indexé GIN.
-- Le schéma est validé côté code via Zod par catégorie (pas de contrainte DB).
-- =============================================================================
CREATE TABLE marketplace_listings (
                                      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                      seller_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                                      category_id uuid NOT NULL REFERENCES marketplace_categories(id) ON DELETE RESTRICT,
                                      brand_id uuid REFERENCES marketplace_brands(id) ON DELETE SET NULL,

    -- Descriptif
                                      title text NOT NULL
                                          CHECK (length(title) >= 3 AND length(title) <= 100),
                                      description text NOT NULL
                                          CHECK (length(description) >= 10 AND length(description) <= 4000),
                                      price_cents integer NOT NULL
                                          CHECK (price_cents >= 100 AND price_cents <= 1000000),
                                      currency text NOT NULL DEFAULT 'EUR'
                                          CHECK (currency = 'EUR'),

                                      condition marketplace_listing_condition NOT NULL,
                                      attributes jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Dimensions/poids — utilisés pour calculer tarif Mondial Relay/Colissimo
                                      weight_grams integer NOT NULL
                                          CHECK (weight_grams > 0 AND weight_grams <= 30000),
                                      length_cm integer
                                          CHECK (length_cm IS NULL OR (length_cm > 0 AND length_cm <= 200)),
                                      width_cm integer
                                          CHECK (width_cm IS NULL OR (width_cm > 0 AND width_cm <= 200)),
                                      depth_cm integer
                                          CHECK (depth_cm IS NULL OR (depth_cm > 0 AND depth_cm <= 200)),

    -- Géoloc ville approchée (jamais coord exactes : privacy)
                                      city text NOT NULL CHECK (length(city) >= 2 AND length(city) <= 100),
                                      postal_code text NOT NULL CHECK (length(postal_code) >= 4 AND length(postal_code) <= 10),
                                      country country_code NOT NULL,
                                      latitude_approx double precision
                                          CHECK (latitude_approx IS NULL OR (latitude_approx >= -90 AND latitude_approx <= 90)),
                                      longitude_approx double precision
                                          CHECK (longitude_approx IS NULL OR (longitude_approx >= -180 AND longitude_approx <= 180)),
                                      geog geography GENERATED ALWAYS AS (
                                          CASE
                                              WHEN latitude_approx IS NOT NULL AND longitude_approx IS NOT NULL
                                                  THEN ST_SetSRID(ST_MakePoint(longitude_approx, latitude_approx), 4326)::geography
                                              ELSE NULL
                                              END
                                          ) STORED,

    -- Cycle de vie
                                      status marketplace_listing_status NOT NULL DEFAULT 'draft',
                                      reserved_until timestamptz,
                                      reserved_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
                                      expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 days'),

    -- Compteurs denormalized (mis à jour par triggers ou par jobs)
                                      view_count integer NOT NULL DEFAULT 0 CHECK (view_count >= 0),
                                      favorite_count integer NOT NULL DEFAULT 0 CHECK (favorite_count >= 0),

                                      created_at timestamptz NOT NULL DEFAULT now(),
                                      updated_at timestamptz NOT NULL DEFAULT now(),
                                      deleted_at timestamptz,

    -- Cohérence réservation : les deux NULL ou les deux NOT NULL
                                      CONSTRAINT chk_listing_reservation CHECK (
                                          (reserved_until IS NULL AND reserved_by_user_id IS NULL) OR
                                          (reserved_until IS NOT NULL AND reserved_by_user_id IS NOT NULL)
                                          )
);

CREATE INDEX idx_marketplace_listings_seller
    ON marketplace_listings(seller_user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_marketplace_listings_active
    ON marketplace_listings(status, created_at DESC)
    WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX idx_marketplace_listings_category
    ON marketplace_listings(category_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_marketplace_listings_brand
    ON marketplace_listings(brand_id)
    WHERE brand_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_marketplace_listings_expires
    ON marketplace_listings(expires_at)
    WHERE status = 'active';

-- Index GIN sur attributes JSONB → recherche/filtre par technique, latéralité, etc.
CREATE INDEX idx_marketplace_listings_attributes
    ON marketplace_listings USING GIN (attributes);

-- Index GIST PostGIS → recherche par rayon
CREATE INDEX idx_marketplace_listings_geog
    ON marketplace_listings USING GIST (geog)
    WHERE geog IS NOT NULL;


-- =============================================================================
-- 7. marketplace_listing_photos
-- =============================================================================
-- Storage path pointe vers bucket marketplace-photos/listings/{listing_id}/...
-- Position 0 = couverture (affichée en thumbnail)
-- Max 6 photos par listing (CHECK position 0..5 + UNIQUE par position)
-- =============================================================================
CREATE TABLE marketplace_listing_photos (
                                            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                            listing_id uuid NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
                                            storage_path text NOT NULL CHECK (storage_path ~ '^listings/'),
  position smallint NOT NULL CHECK (position >= 0 AND position <= 5),
  width_px integer
    CHECK (width_px IS NULL OR (width_px > 0 AND width_px <= 10000)),
  height_px integer
    CHECK (height_px IS NULL OR (height_px > 0 AND height_px <= 10000)),
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(listing_id, position)
);

CREATE INDEX idx_marketplace_listing_photos_listing
    ON marketplace_listing_photos(listing_id, position);


-- =============================================================================
-- 8. marketplace_listing_favorites — wishlist acheteurs
-- =============================================================================
CREATE TABLE marketplace_listing_favorites (
                                               user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                                               listing_id uuid NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
                                               created_at timestamptz NOT NULL DEFAULT now(),
                                               PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX idx_marketplace_favorites_listing
    ON marketplace_listing_favorites(listing_id);


-- =============================================================================
-- 9. marketplace_listing_boosts — boosts payés
-- =============================================================================
-- 1 ligne par achat de boost. Le tri du fil marketplace prend en compte les
-- boosts actifs (ends_at > now() AND status = 'active') pour remonter ces
-- listings en tête, par ordre de starts_at DESC.
-- =============================================================================
CREATE TABLE marketplace_listing_boosts (
                                            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                            listing_id uuid NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
                                            kind marketplace_boost_kind NOT NULL,
                                            starts_at timestamptz NOT NULL,
                                            ends_at timestamptz NOT NULL,
                                            payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
                                            status marketplace_boost_status NOT NULL DEFAULT 'active',
                                            created_at timestamptz NOT NULL DEFAULT now(),

                                            CONSTRAINT chk_boost_window CHECK (ends_at > starts_at)
);

CREATE INDEX idx_marketplace_listing_boosts_active
    ON marketplace_listing_boosts(listing_id, kind, ends_at)
    WHERE status = 'active';

CREATE INDEX idx_marketplace_listing_boosts_window
    ON marketplace_listing_boosts(kind, starts_at, ends_at)
    WHERE status = 'active';


-- =============================================================================
-- 10. marketplace_addresses — adresses livraison réutilisables
-- =============================================================================
CREATE TABLE marketplace_addresses (
                                       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                       user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                                       label text NOT NULL CHECK (length(label) >= 1 AND length(label) <= 50),
                                       full_name text NOT NULL CHECK (length(full_name) >= 2 AND length(full_name) <= 100),
                                       line1 text NOT NULL CHECK (length(line1) >= 3 AND length(line1) <= 200),
                                       line2 text CHECK (line2 IS NULL OR length(line2) <= 200),
                                       postal_code text NOT NULL CHECK (length(postal_code) >= 4 AND length(postal_code) <= 10),
                                       city text NOT NULL CHECK (length(city) >= 2 AND length(city) <= 100),
                                       country country_code NOT NULL,
                                       phone text CHECK (phone IS NULL OR length(phone) <= 30),
                                       is_default boolean NOT NULL DEFAULT false,
                                       created_at timestamptz NOT NULL DEFAULT now(),
                                       updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_addresses_user
    ON marketplace_addresses(user_id);

-- Une seule adresse par défaut par user
CREATE UNIQUE INDEX idx_marketplace_addresses_user_default
    ON marketplace_addresses(user_id)
    WHERE is_default = true;


-- =============================================================================
-- 11. marketplace_offers — système d'offres / négociation prix style Vinted
-- =============================================================================
-- TTL : 48h auto-expire via cron
-- Limite : 3 offres pending max par couple buyer/listing (trigger)
-- Contre-offre : nouvelle offre avec parent_offer_id pointant sur la précédente
-- =============================================================================
CREATE TABLE marketplace_offers (
                                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                    listing_id uuid NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
                                    buyer_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                                    amount_cents integer NOT NULL
                                        CHECK (amount_cents >= 100 AND amount_cents <= 1000000),
                                    status marketplace_offer_status NOT NULL DEFAULT 'pending',
                                    parent_offer_id uuid REFERENCES marketplace_offers(id) ON DELETE SET NULL,
                                    expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
                                    responded_at timestamptz,
                                    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_offers_listing
    ON marketplace_offers(listing_id, status);

CREATE INDEX idx_marketplace_offers_buyer
    ON marketplace_offers(buyer_user_id, status);

CREATE INDEX idx_marketplace_offers_pending_expires
    ON marketplace_offers(expires_at)
    WHERE status = 'pending';


-- =============================================================================
-- 12. marketplace_orders — commandes C2C avec escrow
-- =============================================================================
-- Pricing snapshot : commission, frais Stripe, total, payout sont figés à la
-- création de l'order. Si la commission Sente change après, l'order existant
-- garde ses montants.
-- Adresse livraison : snapshot inline (au cas où l'adresse source est supprimée).
-- =============================================================================
CREATE TABLE marketplace_orders (
                                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                    listing_id uuid NOT NULL REFERENCES marketplace_listings(id) ON DELETE RESTRICT,
                                    buyer_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
                                    seller_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

    -- Snapshot pricing (immuable après création)
                                    item_price_cents integer NOT NULL CHECK (item_price_cents >= 100),
                                    shipping_cents integer NOT NULL CHECK (shipping_cents >= 0),
                                    commission_cents integer NOT NULL CHECK (commission_cents >= 0),
                                    stripe_fees_cents integer NOT NULL CHECK (stripe_fees_cents >= 0),
                                    total_cents integer NOT NULL CHECK (total_cents >= 100),
                                    seller_payout_cents integer NOT NULL CHECK (seller_payout_cents >= 0),
                                    currency text NOT NULL DEFAULT 'EUR',

    -- Status + lifecycle timestamps
                                    status marketplace_order_status NOT NULL DEFAULT 'pending_payment',
                                    paid_at timestamptz,
                                    shipped_at timestamptz,
                                    delivered_at timestamptz,
                                    released_at timestamptz,
                                    closed_at timestamptz,
                                    cancelled_at timestamptz,

    -- Shipping
                                    shipping_carrier marketplace_carrier NOT NULL,
                                    relay_point_id text  -- ID point relais Mondial Relay (NULL si Colissimo domicile)
                                        CHECK (relay_point_id IS NULL OR length(relay_point_id) <= 50),
                                    shipping_label_storage_path text,
                                    tracking_number text
                                        CHECK (tracking_number IS NULL OR length(tracking_number) <= 50),

    -- Adresse livraison (snapshot inline)
                                    shipping_full_name text NOT NULL
                                        CHECK (length(shipping_full_name) >= 2 AND length(shipping_full_name) <= 100),
                                    shipping_line1 text NOT NULL
                                        CHECK (length(shipping_line1) >= 3 AND length(shipping_line1) <= 200),
                                    shipping_line2 text
                                        CHECK (shipping_line2 IS NULL OR length(shipping_line2) <= 200),
                                    shipping_postal_code text NOT NULL
                                        CHECK (length(shipping_postal_code) >= 4 AND length(shipping_postal_code) <= 10),
                                    shipping_city text NOT NULL
                                        CHECK (length(shipping_city) >= 2 AND length(shipping_city) <= 100),
                                    shipping_country country_code NOT NULL,
                                    shipping_phone text CHECK (shipping_phone IS NULL OR length(shipping_phone) <= 30),

    -- Stripe
                                    stripe_payment_intent_id text UNIQUE
                                        CHECK (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id ~ '^pi_'),
  stripe_charge_id text
    CHECK (stripe_charge_id IS NULL OR stripe_charge_id ~ '^ch_'),
  stripe_transfer_id text
    CHECK (stripe_transfer_id IS NULL OR stripe_transfer_id ~ '^tr_'),

  -- Refund
  refunded_amount_cents integer NOT NULL DEFAULT 0
    CHECK (refunded_amount_cents >= 0),
  refund_reason text
    CHECK (refund_reason IS NULL OR (length(refund_reason) >= 10 AND length(refund_reason) <= 1000)),
  refunded_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Garde-fous
  CONSTRAINT chk_order_buyer_not_seller CHECK (buyer_user_id != seller_user_id),
  CONSTRAINT chk_order_total_consistent CHECK (
    total_cents = item_price_cents + shipping_cents + commission_cents + stripe_fees_cents
  ),
  CONSTRAINT chk_order_payout_lte_price CHECK (seller_payout_cents <= item_price_cents)
);

CREATE INDEX idx_marketplace_orders_buyer
    ON marketplace_orders(buyer_user_id, created_at DESC);

CREATE INDEX idx_marketplace_orders_seller
    ON marketplace_orders(seller_user_id, created_at DESC);

CREATE INDEX idx_marketplace_orders_listing
    ON marketplace_orders(listing_id);

CREATE INDEX idx_marketplace_orders_status
    ON marketplace_orders(status, paid_at)
    WHERE status NOT IN ('closed', 'cancelled', 'refunded');

-- Index ciblant les orders éligibles à release auto (cron toutes les heures)
CREATE INDEX idx_marketplace_orders_release_eligible
    ON marketplace_orders(delivered_at)
    WHERE status = 'delivered';


-- =============================================================================
-- 13. marketplace_threads — conversations buyer/seller
-- =============================================================================
-- 1 thread unique par couple (listing, buyer). Le seller est dérivé du listing.
-- Thread reste actif après vente pour SAV.
-- =============================================================================
CREATE TABLE marketplace_threads (
                                     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                     listing_id uuid NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
                                     buyer_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                                     seller_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                                     last_message_at timestamptz,
                                     created_at timestamptz NOT NULL DEFAULT now(),

                                     UNIQUE(listing_id, buyer_user_id),
                                     CONSTRAINT chk_thread_distinct_parties CHECK (buyer_user_id != seller_user_id)
    );

CREATE INDEX idx_marketplace_threads_buyer
    ON marketplace_threads(buyer_user_id, last_message_at DESC);

CREATE INDEX idx_marketplace_threads_seller
    ON marketplace_threads(seller_user_id, last_message_at DESC);


-- =============================================================================
-- 14. marketplace_messages
-- =============================================================================
-- body : texte filtré (visible par participants), avec coordonnées masquées
-- raw_body : texte brut (accès app_admin only via RLS) — purge auto à 90j
-- filtered_flags : compteur des patterns détectés ({"phone": 1, "email": 0, ...})
-- =============================================================================
CREATE TABLE marketplace_messages (
                                      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                      thread_id uuid NOT NULL REFERENCES marketplace_threads(id) ON DELETE CASCADE,
                                      sender_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                                      body text NOT NULL CHECK (length(body) >= 1 AND length(body) <= 2000),
                                      raw_body text NOT NULL CHECK (length(raw_body) >= 1 AND length(raw_body) <= 2000),
                                      filtered_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
                                      read_at timestamptz,
                                      created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_messages_thread
    ON marketplace_messages(thread_id, created_at);

CREATE INDEX idx_marketplace_messages_unread
    ON marketplace_messages(thread_id)
    WHERE read_at IS NULL;


-- =============================================================================
-- 15. marketplace_reviews — notation bidirectionnelle
-- =============================================================================
-- 1 review max par rater par order (UNIQUE)
-- Insert autorisé seulement si l'order est en status 'closed'
-- (vérifié par RLS + Server Action ; pas de contrainte DB cross-table)
-- =============================================================================
CREATE TABLE marketplace_reviews (
                                     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                     order_id uuid NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
                                     rater_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                                     rated_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                                     role marketplace_review_role NOT NULL,
                                     stars smallint NOT NULL CHECK (stars >= 1 AND stars <= 5),
                                     comment text
                                         CHECK (comment IS NULL OR (length(comment) >= 5 AND length(comment) <= 1000)),
                                     created_at timestamptz NOT NULL DEFAULT now(),

                                     UNIQUE(order_id, rater_user_id),
                                     CONSTRAINT chk_review_distinct_parties CHECK (rater_user_id != rated_user_id)
    );

CREATE INDEX idx_marketplace_reviews_rated
    ON marketplace_reviews(rated_user_id, created_at DESC);

CREATE INDEX idx_marketplace_reviews_order
    ON marketplace_reviews(order_id);


-- =============================================================================
-- 16. marketplace_disputes
-- =============================================================================
-- 1 litige max par order. evidence_paths : array de storage paths vers
-- bucket marketplace-photos/disputes/{dispute_id}/...
-- =============================================================================
CREATE TABLE marketplace_disputes (
                                      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                      order_id uuid NOT NULL UNIQUE REFERENCES marketplace_orders(id) ON DELETE RESTRICT,
                                      opened_by_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
                                      reason marketplace_dispute_reason NOT NULL,
                                      description text NOT NULL
                                          CHECK (length(description) >= 20 AND length(description) <= 2000),
                                      evidence_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
                                      status marketplace_dispute_status NOT NULL DEFAULT 'open',
                                      resolution_notes text
                                          CHECK (resolution_notes IS NULL OR length(resolution_notes) <= 2000),
                                      refund_amount_cents integer
                                          CHECK (refund_amount_cents IS NULL OR refund_amount_cents >= 0),
                                      resolved_by_admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
                                      opened_at timestamptz NOT NULL DEFAULT now(),
                                      resolved_at timestamptz,

    -- Cohérence : resolved_at présent ssi status terminal
                                      CONSTRAINT chk_dispute_resolution CHECK (
                                          (status IN ('resolved_buyer', 'resolved_seller', 'resolved_partial')) =
                                          (resolved_at IS NOT NULL)
                                          )
);

CREATE INDEX idx_marketplace_disputes_status
    ON marketplace_disputes(status, opened_at)
    WHERE status IN ('open', 'in_review');


-- =============================================================================
-- 17. Helpers SQL réutilisables (pour RLS et Server Actions)
-- =============================================================================

-- Calcul pricing complet d'un order C2C (commission + frais Stripe répercutés)
-- Formule : commission Sente = 5% du prix produit + 0,70€
--          frais Stripe       = 1,5% du total + 0,25€ (résolu par équation circulaire)
--          total acheteur    = (prix + shipping + commission + 25) / 0,985
-- Le vendeur reçoit le prix produit en entier (les frais sont payés par l'acheteur).
CREATE OR REPLACE FUNCTION fn_marketplace_calculate_pricing(
  p_item_price_cents integer,
  p_shipping_cents integer
) RETURNS TABLE (
  item_price_cents integer,
  shipping_cents integer,
  commission_cents integer,
  stripe_fees_cents integer,
  total_cents integer,
  seller_payout_cents integer
) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
v_commission integer;
  v_total numeric;
  v_total_int integer;
  v_stripe_fees integer;
BEGIN
  IF p_item_price_cents < 100 THEN
    RAISE EXCEPTION 'Prix minimum 1€ (100 cents)';
END IF;

  -- Commission Sente nette
  v_commission := (p_item_price_cents * 5 / 100) + 70;

  -- Résolution équation circulaire pour répercuter exactement les frais Stripe
  v_total := (p_item_price_cents + p_shipping_cents + v_commission + 25)::numeric / 0.985;
  v_total_int := CEIL(v_total)::integer;  -- arrondi au-dessus pour ne jamais sous-couvrir Stripe

  v_stripe_fees := v_total_int - p_item_price_cents - p_shipping_cents - v_commission;

RETURN QUERY SELECT
    p_item_price_cents,
    p_shipping_cents,
    v_commission,
    v_stripe_fees,
    v_total_int,
    p_item_price_cents;
END;
$$;

COMMENT ON FUNCTION fn_marketplace_calculate_pricing IS
  'Décompose le pricing d''un order C2C : commission Sente (5% + 0,70€), frais Stripe répercutés (1,5% + 0,25€), total acheteur, payout vendeur (= prix produit entier)';


-- KYC seller verified ET capable d'encaisser
CREATE OR REPLACE FUNCTION fn_marketplace_is_seller_verified(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT EXISTS (
    SELECT 1 FROM marketplace_seller_accounts
    WHERE user_id = p_user_id
      AND kyc_status = 'verified'
      AND stripe_charges_enabled = true
      AND stripe_payouts_enabled = true
);
$$;


-- Ownership listing (pour RLS sur photos, boosts, etc.)
CREATE OR REPLACE FUNCTION fn_marketplace_is_listing_owner(p_listing_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT EXISTS (
    SELECT 1 FROM marketplace_listings
    WHERE id = p_listing_id
      AND seller_user_id = auth.uid()
      AND deleted_at IS NULL
);
$$;


-- Participation à un order (buyer ou seller)
CREATE OR REPLACE FUNCTION fn_marketplace_is_order_party(p_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT EXISTS (
    SELECT 1 FROM marketplace_orders
    WHERE id = p_order_id
      AND (buyer_user_id = auth.uid() OR seller_user_id = auth.uid())
);
$$;


-- Participation à un thread
CREATE OR REPLACE FUNCTION fn_marketplace_is_thread_participant(p_thread_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT EXISTS (
    SELECT 1 FROM marketplace_threads
    WHERE id = p_thread_id
      AND (buyer_user_id = auth.uid() OR seller_user_id = auth.uid())
);
$$;


-- User est lié à une org pro (magasin OU étang) via membership accepté
-- Bloque les pros de poster sur le marketplace C2C (cohérence : marketplace = particuliers)
CREATE OR REPLACE FUNCTION fn_marketplace_user_is_pro(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT EXISTS (
    SELECT 1
    FROM memberships m
             JOIN organizations o ON o.id = m.organization_id
    WHERE m.user_id = p_user_id
      AND m.accepted_at IS NOT NULL
      AND o.org_type IN ('magasin', 'etang')
      AND o.deleted_at IS NULL
);
$$;


-- =============================================================================
-- 18. Triggers métier
-- =============================================================================

-- ---- updated_at auto sur les tables marketplace
CREATE OR REPLACE FUNCTION trg_marketplace_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_seller_accounts_updated_at
    BEFORE UPDATE ON marketplace_seller_accounts
    FOR EACH ROW EXECUTE FUNCTION trg_marketplace_set_updated_at();

CREATE TRIGGER trg_marketplace_brands_updated_at
    BEFORE UPDATE ON marketplace_brands
    FOR EACH ROW EXECUTE FUNCTION trg_marketplace_set_updated_at();

CREATE TRIGGER trg_marketplace_listings_updated_at
    BEFORE UPDATE ON marketplace_listings
    FOR EACH ROW EXECUTE FUNCTION trg_marketplace_set_updated_at();

CREATE TRIGGER trg_marketplace_addresses_updated_at
    BEFORE UPDATE ON marketplace_addresses
    FOR EACH ROW EXECUTE FUNCTION trg_marketplace_set_updated_at();

CREATE TRIGGER trg_marketplace_orders_updated_at
    BEFORE UPDATE ON marketplace_orders
    FOR EACH ROW EXECUTE FUNCTION trg_marketplace_set_updated_at();


-- ---- Anti-pros : bloque magasins/étangs de publier en marketplace C2C
CREATE OR REPLACE FUNCTION trg_marketplace_block_pros()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Vérifie seulement si le listing va devenir public
  IF NEW.status IN ('active', 'pending_review') THEN
    IF fn_marketplace_user_is_pro(NEW.seller_user_id) THEN
      RAISE EXCEPTION 'Les comptes liés à un magasin ou un étang ne peuvent pas vendre sur le marketplace C2C'
        USING ERRCODE = 'check_violation';
END IF;
END IF;
RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_listings_block_pros
    BEFORE INSERT OR UPDATE ON marketplace_listings
                         FOR EACH ROW EXECUTE FUNCTION trg_marketplace_block_pros();


-- ---- KYC obligatoire pour publier
CREATE OR REPLACE FUNCTION trg_marketplace_require_kyc_to_publish()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Bloque le passage en 'active' si KYC pas verified
  -- 'pending_review' autorisé sans KYC complet (workflow modération première annonce)
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status != 'active') THEN
    IF NOT fn_marketplace_is_seller_verified(NEW.seller_user_id) THEN
      RAISE EXCEPTION 'Le KYC vendeur doit être validé (Stripe Connect Express + DAC7) avant publication'
        USING ERRCODE = 'check_violation';
END IF;
END IF;
RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_listings_require_kyc
    BEFORE INSERT OR UPDATE ON marketplace_listings
                         FOR EACH ROW EXECUTE FUNCTION trg_marketplace_require_kyc_to_publish();


-- ---- Limite 3 offres pending par couple buyer/listing
CREATE OR REPLACE FUNCTION trg_marketplace_offers_max_pending()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
v_count integer;
BEGIN
  IF NEW.status = 'pending' THEN
SELECT COUNT(*) INTO v_count
FROM marketplace_offers
WHERE buyer_user_id = NEW.buyer_user_id
  AND listing_id = NEW.listing_id
  AND status = 'pending'
  AND id != NEW.id;

IF v_count >= 3 THEN
      RAISE EXCEPTION 'Maximum 3 offres en attente sur la même annonce'
        USING ERRCODE = 'check_violation';
END IF;
END IF;
RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_offers_max_pending
    BEFORE INSERT OR UPDATE ON marketplace_offers
                         FOR EACH ROW EXECUTE FUNCTION trg_marketplace_offers_max_pending();


-- ---- Empêche un seller de faire une offre sur son propre listing
CREATE OR REPLACE FUNCTION trg_marketplace_offers_no_self()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
v_seller_id uuid;
BEGIN
SELECT seller_user_id INTO v_seller_id
FROM marketplace_listings WHERE id = NEW.listing_id;

IF v_seller_id = NEW.buyer_user_id THEN
    RAISE EXCEPTION 'Vous ne pouvez pas faire une offre sur votre propre annonce'
      USING ERRCODE = 'check_violation';
END IF;
RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_offers_no_self
    BEFORE INSERT ON marketplace_offers
    FOR EACH ROW EXECUTE FUNCTION trg_marketplace_offers_no_self();


-- ---- Compteur favorite_count denormalized
CREATE OR REPLACE FUNCTION trg_marketplace_favorites_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
UPDATE marketplace_listings
SET favorite_count = favorite_count + 1
WHERE id = NEW.listing_id;
ELSIF TG_OP = 'DELETE' THEN
UPDATE marketplace_listings
SET favorite_count = GREATEST(0, favorite_count - 1)
WHERE id = OLD.listing_id;
END IF;
RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_marketplace_favorites_count
    AFTER INSERT OR DELETE ON marketplace_listing_favorites
  FOR EACH ROW EXECUTE FUNCTION trg_marketplace_favorites_count();


-- ---- last_message_at sur thread
CREATE OR REPLACE FUNCTION trg_marketplace_thread_last_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
UPDATE marketplace_threads
SET last_message_at = NEW.created_at
WHERE id = NEW.thread_id;
RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_thread_last_message
    AFTER INSERT ON marketplace_messages
    FOR EACH ROW EXECUTE FUNCTION trg_marketplace_thread_last_message();


-- ---- Compteurs DAC7 YTD à chaque order closed
CREATE OR REPLACE FUNCTION trg_marketplace_dac7_counters()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
v_year integer := EXTRACT(YEAR FROM now())::integer;
BEGIN
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    -- Si le compteur YTD est sur une année antérieure → reset puis increment
    -- Sinon increment normal
UPDATE marketplace_seller_accounts
SET
    ytd_year = v_year,
    sales_count_ytd = CASE
                          WHEN ytd_year = v_year THEN sales_count_ytd + 1
                          ELSE 1
        END,
    sales_amount_cents_ytd = CASE
                                 WHEN ytd_year = v_year THEN sales_amount_cents_ytd + NEW.item_price_cents
                                 ELSE NEW.item_price_cents
        END
WHERE user_id = NEW.seller_user_id;
END IF;
RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_orders_dac7
    AFTER UPDATE ON marketplace_orders
    FOR EACH ROW EXECUTE FUNCTION trg_marketplace_dac7_counters();


-- =============================================================================
-- 19. Vérifications post-migration
-- =============================================================================
DO $$
DECLARE
v_enums_count integer;
  v_tables_count integer;
  v_functions_count integer;
BEGIN
SELECT COUNT(*) INTO v_enums_count
FROM pg_type WHERE typname LIKE 'marketplace_%';
ASSERT v_enums_count >= 11, format('Enums marketplace manquants : %s/11', v_enums_count);

SELECT COUNT(*) INTO v_tables_count
FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'marketplace_%';
ASSERT v_tables_count = 14, format('Tables marketplace manquantes : %s/14', v_tables_count);

SELECT COUNT(*) INTO v_functions_count
FROM pg_proc WHERE proname LIKE 'fn_marketplace_%';
ASSERT v_functions_count >= 6, format('Helpers SQL manquants : %s/6', v_functions_count);

  RAISE NOTICE 'Migration 0035 OK : % enums, % tables, % helpers', v_enums_count, v_tables_count, v_functions_count;
END;
$$;