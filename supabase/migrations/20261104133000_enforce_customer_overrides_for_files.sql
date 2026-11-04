-- Keep private storage checks aligned with member/product/resource overrides.
create or replace function private.has_active_entitlement(p uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_active_product_access(p)
$$;
revoke all on function private.has_active_entitlement(uuid) from public, anon;
grant execute on function private.has_active_entitlement(uuid) to authenticated;

drop policy if exists deliverables_buyer_read on storage.objects;
create policy deliverables_buyer_read on storage.objects for select to authenticated
  using (
    bucket_id = 'deliverables'
    and exists (
      select 1 from public.product_deliverables d
      where d.storage_path = objects.name
        and private.can_access_product_resource(d.product_id, d.id)
    )
  );
