# Cohort analytics demo data

The current product has 12 clearly marked synthetic paid orders at the listed one-time price of ₹2,499, dated across the last 88 days, plus 12 active access entitlements and 12 synthetic customer profiles. This creates ₹29,988 in demo revenue for analytics refinement. The `orders.is_demo` flag and `cohort-demo-202610-*` provider order IDs identify them. No payment provider was called and no money moved.

To remove this sample later, run `cleanup_demo_sales.sql` in the Supabase SQL editor. It deletes only the tagged demo orders, their entitlements, and the associated `.invalid` synthetic accounts.
