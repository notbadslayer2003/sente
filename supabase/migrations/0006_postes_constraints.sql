-- =============================================================================
-- Sente — Maintien automatique du compteur etang_details.postes_count
-- =============================================================================
-- Au lieu de demander à chaque server action de gérer le compteur, on le
-- maintient via trigger. Les inserts/deletes/updates de postes mettent à
-- jour postes_count atomiquement.
-- =============================================================================

create or replace function public.tg_postes_count()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
v_etang_id uuid;
begin
  if (tg_op = 'INSERT') then
    v_etang_id := new.etang_id;
  elsif (tg_op = 'DELETE') then
    v_etang_id := old.etang_id;
  elsif (tg_op = 'UPDATE') then
    -- Si le poste change d'étang (cas rare mais possible), on update les deux
    if new.etang_id <> old.etang_id then
update public.etang_details
set postes_count = (
    select count(*) from public.postes
    where etang_id = old.etang_id and active = true
)
where organization_id = old.etang_id;
end if;
    v_etang_id := new.etang_id;
end if;

update public.etang_details
set postes_count = (
    select count(*) from public.postes
    where etang_id = v_etang_id and active = true
)
where organization_id = v_etang_id;

return null;
end;
$$;

create trigger tg_postes_count
    after insert or update or delete on public.postes
    for each row execute function public.tg_postes_count();