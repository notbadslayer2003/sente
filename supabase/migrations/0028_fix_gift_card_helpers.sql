-- =============================================================================
-- Sente — Fix gift_card helpers
-- =============================================================================
-- Corrections sur les RPCs de la migration 0026 :
--   1. gen_gift_card_code utilisait gen_random_bytes() qui est dans le schéma
--      `extensions` sur Supabase, pas accessible avec search_path = public.
--      On utilise extensions.gen_random_bytes() explicitement.
--   2. apply_gift_card_to_cart était executable par `anon`, on bloque.
--
-- Ne pas oublier : on ne modifie jamais une migration appliquée. On corrige
-- via une nouvelle migration.
-- =============================================================================


-- =============================================================================
-- 1. Fix gen_gift_card_code : utiliser extensions.gen_random_bytes
-- =============================================================================

create or replace function public.gen_gift_card_code()
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
v_chars text := 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_attempt integer := 0;
  v_part text;
  v_byte integer;
  v_i integer;
begin
  loop
v_attempt := v_attempt + 1;
    if v_attempt > 10 then
      raise exception 'Impossible de générer un code unique après 10 tentatives'
        using errcode = 'XX000';
end if;

    -- Génère 16 chars en 4 groupes de 4
    v_code := '';
for v_i in 1..16 loop
      -- Note : extensions.gen_random_bytes (pas public) car pgcrypto est dans extensions
      v_byte := get_byte(extensions.gen_random_bytes(1), 0);
      v_code := v_code || substr(v_chars, (v_byte % 33) + 1, 1);
      if v_i in (4, 8, 12) then
        v_code := v_code || '-';
end if;
end loop;

    -- Vérifie unicité
    if not exists (select 1 from public.gift_cards where code = v_code) then
      return v_code;
end if;
end loop;
end;
$$;

revoke execute on function public.gen_gift_card_code() from public, authenticated, anon;

comment on function public.gen_gift_card_code() is
  'Génère un code de bon cadeau 16 chars alphanum unique au format XXXX-XXXX-XXXX-XXXX. '
  'Utilise extensions.gen_random_bytes (pgcrypto). 33^16 ≈ 1.4×10^24 possibilités.';


-- =============================================================================
-- 2. Resserre apply_gift_card_to_cart (placeholder) — pas accessible à anon
-- =============================================================================

revoke execute on function public.apply_gift_card_to_cart(uuid, text) from public, anon;
grant execute on function public.apply_gift_card_to_cart(uuid, text) to authenticated;


-- =============================================================================
-- Fin de la migration 0027
-- =============================================================================