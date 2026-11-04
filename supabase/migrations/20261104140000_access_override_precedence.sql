-- A full-program restriction always wins; resource grants remain scoped below it.
create or replace function private.can_access_product_resource(p_product_id uuid, p_resource_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when private.is_business_customer_blocked(p.business_id,(select auth.uid())) then false
    when exists (select 1 from public.customer_product_access a where a.product_id=p_product_id and a.customer_id=(select auth.uid()) and a.resource_id is null and a.effect='revoke') then false
    when exists (select 1 from public.customer_product_access a where a.product_id=p_product_id and a.customer_id=(select auth.uid()) and a.resource_id=p_resource_id) then
      (select a.effect='grant' from public.customer_product_access a where a.product_id=p_product_id and a.customer_id=(select auth.uid()) and a.resource_id=p_resource_id limit 1)
    else private.has_active_product_access(p_product_id)
  end
  from public.products p where p.id=p_product_id
$$;
revoke all on function private.can_access_product_resource(uuid,uuid) from public, anon;
grant execute on function private.can_access_product_resource(uuid,uuid) to authenticated;
