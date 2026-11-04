-- Validate every customer and resource scope on the database boundary.
drop policy if exists customer_product_access_owner_all on public.customer_product_access;
create policy customer_product_access_owner_all on public.customer_product_access for all to authenticated
  using (private.owns_business(business_id) and exists (select 1 from public.products p where p.id=customer_product_access.product_id and p.business_id=customer_product_access.business_id))
  with check (private.owns_business(business_id)
    and exists (select 1 from public.products p where p.id=customer_product_access.product_id and p.business_id=customer_product_access.business_id)
    and (resource_id is null or exists (select 1 from public.product_deliverables d where d.id=customer_product_access.resource_id and d.product_id=customer_product_access.product_id))
    and exists (select 1 from public.orders o where o.business_id=customer_product_access.business_id and o.buyer_id=customer_product_access.customer_id
      union all select 1 from public.entitlements e where e.business_id=customer_product_access.business_id and e.buyer_id=customer_product_access.customer_id));

drop policy if exists member_resource_progress_member_read on public.member_resource_progress;
create policy member_resource_progress_member_read on public.member_resource_progress for select to authenticated
  using (customer_id=(select auth.uid()) and private.can_access_product_resource(product_id,resource_id)
    and exists (select 1 from public.products p join public.product_deliverables d on d.product_id=p.id
      where p.id=member_resource_progress.product_id and p.business_id=member_resource_progress.business_id and d.id=member_resource_progress.resource_id));
drop policy if exists member_resource_progress_member_update on public.member_resource_progress;
create policy member_resource_progress_member_update on public.member_resource_progress for update to authenticated
  using (customer_id=(select auth.uid()) and private.can_access_product_resource(product_id,resource_id)
    and exists (select 1 from public.products p join public.product_deliverables d on d.product_id=p.id where p.id=member_resource_progress.product_id and p.business_id=member_resource_progress.business_id and d.id=member_resource_progress.resource_id))
  with check (customer_id=(select auth.uid()) and private.can_access_product_resource(product_id,resource_id)
    and exists (select 1 from public.products p join public.product_deliverables d on d.product_id=p.id where p.id=member_resource_progress.product_id and p.business_id=member_resource_progress.business_id and d.id=member_resource_progress.resource_id));
