drop policy if exists business_customer_blocks_member_read on public.business_customer_blocks;
create policy business_customer_blocks_member_read on public.business_customer_blocks for select to authenticated
  using (customer_id=(select auth.uid()));
