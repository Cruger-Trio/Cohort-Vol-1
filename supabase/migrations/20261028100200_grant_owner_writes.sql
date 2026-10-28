-- Authenticated table privileges must complement the existing owner-only RLS policies.
grant insert, update on table public.businesses to authenticated;
grant insert, update on table public.products to authenticated;
grant insert, update on table public.prices to authenticated;
grant insert, update on table public.product_deliverables to authenticated;
