-- Keep the customer access policy from querying products under products' own RLS.
-- Scope validation is moved into a definer helper so the products policy and access policy cannot recurse.
create or replace function private.owns_customer_product_scope(p_business_id uuid, p_product_id uuid, p_resource_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.owns_business(p_business_id) and exists (
    select 1 from public.products p
    where p.id = p_product_id
      and p.business_id = p_business_id
      and (p_resource_id is null or exists (
        select 1 from public.product_deliverables d
        where d.id = p_resource_id and d.product_id = p.id
      ))
  )
$$;
revoke all on function private.owns_customer_product_scope(uuid, uuid, uuid) from public, anon;
grant execute on function private.owns_customer_product_scope(uuid, uuid, uuid) to authenticated;

drop policy if exists customer_product_access_owner_all on public.customer_product_access;
create policy customer_product_access_owner_all on public.customer_product_access for all to authenticated
  using (private.owns_business(business_id))
  with check (private.owns_customer_product_scope(business_id, product_id, resource_id)
    and exists (
      select 1 from public.orders o where o.business_id=customer_product_access.business_id and o.buyer_id=customer_product_access.customer_id
      union all
      select 1 from public.entitlements e where e.business_id=customer_product_access.business_id and e.buyer_id=customer_product_access.customer_id
    ));
