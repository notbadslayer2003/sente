drop function if exists public.publish_product(uuid);

create or replace function public.publish_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id        uuid;
  v_org_id         uuid;
  v_status         product_status;
  v_kind           text;
  v_photos_count   integer;
  v_variants_count integer;
  v_min_price      integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

select organization_id, status, kind, cardinality(photos)
into v_org_id, v_status, v_kind, v_photos_count
from public.products
where id = p_product_id and deleted_at is null;

if v_org_id is null then
    raise exception 'Produit introuvable' using errcode = '42P01';
end if;

  if not public.is_org_member(v_org_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

  if v_status = 'published' then
    return;
end if;

  if v_status = 'archived' then
    raise exception 'Produit archivé. Réactive-le avant de publier.' using errcode = '23514';
end if;

  -- Photo obligatoire seulement pour produits physiques
  if v_kind = 'physical' and v_photos_count = 0 then
    raise exception 'Ajoute au moins une photo avant de publier' using errcode = '23514';
end if;

  -- Au moins une variante active avec prix > 1€ (peu importe le kind)
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

revoke execute on function public.publish_product(uuid) from public, anon;
grant execute on function public.publish_product(uuid) to authenticated;