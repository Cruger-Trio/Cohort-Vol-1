-- Limit creator-side mutations to actions exposed by the product UI.
revoke update on public.product_access_codes from authenticated;
grant update (disabled_at) on public.product_access_codes to authenticated;

revoke update on public.entitlements from authenticated;
grant update (status, ends_at) on public.entitlements to authenticated;

alter table public.products drop constraint if exists products_type_check;
alter table public.products add constraint products_type_check
  check (type = any (array[
    'Digital product', 'Course', 'Membership', 'Community',
    'Software access', 'Live experience'
  ]));
