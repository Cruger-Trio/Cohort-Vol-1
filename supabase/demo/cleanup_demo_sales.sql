-- Remove only the synthetic records seeded for Cohort analytics review.
begin;

delete from public.entitlements
where order_id in (
  select id from public.orders
  where is_demo = true and provider_order_id like 'cohort-demo-202610-%'
);

delete from public.orders
where is_demo = true and provider_order_id like 'cohort-demo-202610-%';

delete from auth.users
where email like 'demo.customer.%@cohort.invalid'
  and raw_user_meta_data->>'source' = 'cohort_analytics_seed';

commit;
