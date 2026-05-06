-- =============================================================================
-- Sente — Étension create_product_draft : support du paramètre kind
-- =============================================================================
-- Ajoute un paramètre p_kind. Drop la version 5-paramètres pour éviter
-- la coexistence de deux signatures.
-- =============================================================================

drop function if exists public.create_product_draft(uuid, uuid, text, text, text);

create or replace function public.create_product_draft(
  p_organization_id uuid,
  p_category_id     uuid,
  p_name            text,
  p_short_desc      text default null,
  p_brand           text default null,
  p_kind            text default 'physical'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id          uuid;
  v_org_type         text;
  v_product_id       uuid;
  v_slug             text;
  v_base_slug        text;
  v_counter          integer := 0;
  v_category_parent  uuid;
  v_gift_category_id uuid := '00000000-0000-0000-0099-000000000001'::uuid;
  v_default_price    integer;
  v_default_stock    integer;
  v_default_options  jsonb;
  v_default_sku      text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  if not public.is_org_member(p_organization_id) then
    raise exception 'Tu n''es pas membre de cette organisation' using errcode = '42501';
end if;

select org_type into v_org_type from public.organizations where id = p_organization_id;
if v_org_type <> 'magasin' then
    raise exception 'Seuls les magasins peuvent créer des produits' using errcode = '23514';
end if;

  if p_kind not in ('physical', 'gift_card') then
    raise exception 'Type de produit invalide : %', p_kind using errcode = '23514';
end if;

  if p_kind = 'gift_card' then
    p_category_id := v_gift_category_id;
end if;

select parent_id into v_category_parent from public.product_categories where id = p_category_id;

if p_kind = 'physical' and v_category_parent is null then
    raise exception 'Choisis une sous-catégorie (pas une catégorie racine)' using errcode = '23514';
end if;

  if p_name is null or length(trim(p_name)) < 2 or length(p_name) > 150 then
    raise exception 'Nom invalide (2-150 caractères)' using errcode = '23514';
end if;

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

insert into public.products (
    organization_id, category_id, kind, status, slug, name, short_desc, brand
)
values (
           p_organization_id, p_category_id, p_kind, 'draft', v_slug,
           trim(p_name),
           nullif(trim(coalesce(p_short_desc, '')), ''),
           nullif(trim(coalesce(p_brand, '')), '')
       )
    returning id into v_product_id;

if p_kind = 'gift_card' then
    v_default_price := 2500;
    v_default_stock := null;
    v_default_options := '{"Valeur": "25 €"}'::jsonb;
    v_default_sku := 'GC-25-' || substring(v_product_id::text from 1 for 6);
else
    v_default_price := 100;
    v_default_stock := 0;
    v_default_options := '{}'::jsonb;
    v_default_sku := 'SKU-' || substring(v_product_id::text from 1 for 8);
end if;

insert into public.product_variants (
    product_id, sku, price_cents, stock_quantity, options, display_order
)
values (
           v_product_id,
           v_default_sku,
           v_default_price,
           v_default_stock,
           v_default_options,
           0
       );

insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id, 'product.create', 'product', v_product_id,
           jsonb_build_object(
                   'organization_id', p_organization_id,
                   'name', p_name,
                   'slug', v_slug,
                   'kind', p_kind
           )
       );

return v_product_id;
end;
$$;

revoke execute on function public.create_product_draft(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.create_product_draft(uuid, uuid, text, text, text, text) to authenticated;

comment on function public.create_product_draft(uuid, uuid, text, text, text, text) is
  'Crée un produit en brouillon avec une variante par défaut. Si kind=gift_card, '
  'force category_id à cartes-cadeaux et crée une variante 25€ stock illimité.';