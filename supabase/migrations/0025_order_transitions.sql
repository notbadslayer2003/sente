-- =============================================================================
-- Sente — V1.5 e-commerce : transitions de statut commande
-- =============================================================================
-- RPC pour faire avancer le statut d'une commande côté magasin :
--   paid → preparing → (ready_for_pickup OU shipped) → delivered
--
-- Règles métier :
--   - Pas de retour en arrière (Q1.a validé)
--   - Pas de skip de statut (Q1.b validé)
--   - Transitions par owner/admin/staff (Q1.c validé)
--   - shipped requiert tracking_number + tracking_carrier
--   - ready_for_pickup réservé aux commandes click_collect
--   - shipped réservé aux commandes shipping_*
--   - delivered uniquement depuis ready_for_pickup ou shipped
-- =============================================================================


-- =============================================================================
-- 1. RPC transition_order_status
-- =============================================================================
-- Centralise toutes les transitions valides. Vérifie cohérence delivery_method
-- + statut courant + paramètres (tracking obligatoire pour shipped).
--
-- Retour : void (l'erreur est levée si transition invalide)
-- =============================================================================

create or replace function public.transition_order_status(
  p_order_id          uuid,
  p_new_status        order_status,
  p_tracking_carrier  text default null,
  p_tracking_number   text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_user_id           uuid;
  v_magasin_id        uuid;
  v_current_status    order_status;
  v_delivery_method   delivery_method;
  v_buyer_id          uuid;
  v_updated_count     integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
end if;

  -- Lock + récup commande
select magasin_id, status, delivery_method, buyer_user_id
into v_magasin_id, v_current_status, v_delivery_method, v_buyer_id
from public.orders
where id = p_order_id
    for update;

if v_magasin_id is null then
    raise exception 'Commande introuvable' using errcode = '42P01';
end if;

  -- Auth : owner/admin/staff du magasin
  if not public.is_org_member(v_magasin_id) then
    raise exception 'Accès refusé' using errcode = '42501';
end if;

  -- Validation transition (matrice)
  -- paid → preparing
  -- preparing → ready_for_pickup (click_collect uniquement)
  -- preparing → shipped (shipping_standard, shipping_local)
  -- ready_for_pickup → delivered
  -- shipped → delivered
  if p_new_status = 'preparing' then
    if v_current_status <> 'paid' then
      raise exception 'Une commande doit être en statut "paid" pour passer en préparation (statut actuel: %)',
        v_current_status using errcode = '22023';
end if;

  elsif p_new_status = 'ready_for_pickup' then
    if v_current_status <> 'preparing' then
      raise exception 'Une commande doit être en préparation avant d''être prête (statut actuel: %)',
        v_current_status using errcode = '22023';
end if;
    if v_delivery_method <> 'click_collect' then
      raise exception 'Le statut "prête à retirer" est réservé au retrait en magasin'
        using errcode = '22023';
end if;

  elsif p_new_status = 'shipped' then
    if v_current_status <> 'preparing' then
      raise exception 'Une commande doit être en préparation avant d''être expédiée (statut actuel: %)',
        v_current_status using errcode = '22023';
end if;
    if v_delivery_method = 'click_collect' then
      raise exception 'Une commande retrait en magasin ne peut pas être expédiée'
        using errcode = '22023';
end if;
    if p_tracking_carrier is null or length(trim(p_tracking_carrier)) = 0 then
      raise exception 'Transporteur requis pour marquer comme expédié'
        using errcode = '22023';
end if;
    if p_tracking_number is null or length(trim(p_tracking_number)) = 0 then
      raise exception 'Numéro de tracking requis pour marquer comme expédié'
        using errcode = '22023';
end if;

  elsif p_new_status = 'delivered' then
    if v_current_status not in ('ready_for_pickup', 'shipped') then
      raise exception 'Une commande doit être prête (click_collect) ou expédiée avant d''être livrée (statut actuel: %)',
        v_current_status using errcode = '22023';
end if;

else
    raise exception 'Transition vers le statut "%" non autorisée via cette RPC',
      p_new_status using errcode = '22023';
end if;

  -- Update : on REQUIERT que le statut courant matche (anti race condition entre 2 staff)
update public.orders
set status = p_new_status,
    tracking_carrier = case
                           when p_new_status = 'shipped' then trim(p_tracking_carrier)
                           else tracking_carrier
        end,
    tracking_number = case
                          when p_new_status = 'shipped' then trim(p_tracking_number)
                          else tracking_number
        end,
    shipped_at = case
                     when p_new_status = 'shipped' then now()
                     else shipped_at
        end,
    delivered_at = case
                       when p_new_status = 'delivered' then now()
                       else delivered_at
        end,
    updated_at = now()
where id = p_order_id
  and status = v_current_status; -- ← race guard

get diagnostics v_updated_count = row_count;
if v_updated_count = 0 then
    raise exception
      'Transition annulée : le statut a changé entre-temps. Recharge la page.'
      using errcode = '40001';
end if;

  -- Notification au buyer (sauf pour 'preparing' et 'delivered' — Q2 validé)
  if p_new_status in ('ready_for_pickup', 'shipped') then
    perform public.fn_notify(
      p_recipient_user_id := v_buyer_id,
      p_type := 'account_action',
      p_target_org_id := v_magasin_id,
      p_payload := jsonb_build_object(
        'action', case
          when p_new_status = 'ready_for_pickup' then 'order_ready_for_pickup'
          when p_new_status = 'shipped' then 'order_shipped'
        end,
        'order_id', p_order_id,
        'tracking_carrier', p_tracking_carrier,
        'tracking_number', p_tracking_number
      )
    );
end if;

  -- Audit
insert into public.audit_log (actor_user_id, action, target_type, target_id, payload)
values (
           v_user_id,
           'order.transition',
           'order',
           p_order_id,
           jsonb_build_object(
                   'from_status', v_current_status,
                   'to_status', p_new_status,
                   'tracking_carrier', p_tracking_carrier,
                   'tracking_number', p_tracking_number
           )
       );
end;
$$;

revoke execute on function public.transition_order_status(uuid, order_status, text, text) from public;
grant execute on function public.transition_order_status(uuid, order_status, text, text) to authenticated;

comment on function public.transition_order_status(uuid, order_status, text, text) is
  'Fait avancer une commande dans le workflow paid → preparing → ready_for_pickup/shipped → delivered. '
  'Vérifie cohérence delivery_method, requiert tracking pour shipped, race-guard via status courant. '
  'Notifie buyer pour ready_for_pickup et shipped.';


-- =============================================================================
-- 2. RPC notify_magasin_new_order (helper appelé par le webhook)
-- =============================================================================
-- Notifie tous les membres actifs (owner/admin/staff) d'un magasin qu'une
-- nouvelle commande est arrivée. Appelée par le webhook Stripe après
-- mark_shop_order_paid réussi.
-- =============================================================================

create or replace function public.notify_magasin_new_order(
  p_order_id  uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
v_magasin_id  uuid;
  v_total_cents integer;
  v_member      record;
begin
select magasin_id, total_cents
into v_magasin_id, v_total_cents
from public.orders
where id = p_order_id;

if v_magasin_id is null then
    raise exception 'Commande % introuvable', p_order_id using errcode = '42P01';
end if;

  -- Notifie chaque membre actif du magasin
for v_member in
select user_id
from public.memberships
where organization_id = v_magasin_id
  and accepted_at is not null
    loop
    perform public.fn_notify(
      p_recipient_user_id := v_member.user_id,
      p_type := 'account_action',
      p_target_org_id := v_magasin_id,
      p_payload := jsonb_build_object(
        'action', 'magasin_new_order',
        'order_id', p_order_id,
        'total_cents', v_total_cents
      )
    );
end loop;
end;
$$;

revoke execute on function public.notify_magasin_new_order(uuid) from public;
-- Pas de grant : appelée uniquement par service_role depuis le webhook

comment on function public.notify_magasin_new_order(uuid) is
  'Notifie tous les membres actifs d''un magasin (owner/admin/staff) qu''une '
  'nouvelle commande est arrivée. Appelée par le webhook Stripe après mark_shop_order_paid.';

-- =============================================================================
-- Fin de la migration 0024
-- =============================================================================