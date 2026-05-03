-- =============================================================================
-- Sente — Ajout colonne phone sur profiles
-- =============================================================================

alter table public.profiles
    add column if not exists phone text
    check (phone is null or length(phone) <= 50);

comment on column public.profiles.phone is
  'Numéro de téléphone du pêcheur, optionnel. Utilisé pour pré-remplir les inscriptions événements.';