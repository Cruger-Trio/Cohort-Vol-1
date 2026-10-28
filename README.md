# Cohort — India’s creator marketplace

A responsive creator marketplace MVP with Supabase email authentication and a signed-in user portal.

## Run locally

Node.js 22+ is required. Start the server from this folder:

```powershell
node --env-file=.env server.mjs
```

Open [http://localhost:4173](http://localhost:4173). The server reads `.env`, returns only the Supabase URL and anon key from `/api/public-config`, and never serves dotfiles.

## Project structure

- `src/core/`: Supabase browser client and public configuration
- `src/data/`: relational workspace and catalog queries
- `src/marketplace/`: public marketplace and product pages
- `src/portal/`: auth, personal portal, and business page modules
- `api/`: small serverless endpoints for public config and product-link metadata
- `vendor/auth.js`: generated browser bundle from the local Supabase dependency

## Auth and personal portal

- Email/password signup and login, email confirmation, password reset, persistent sessions, and sign-out
- Profile identity with editable name, username, location, bio, cover images or short videos, and buyer/access counts derived from paid orders and entitlements
- Created/Joined profile tabs, profile editing, and a business workspace switcher
- Personal portal sections for orders, messages, partners, affiliates, workforce, communities, resolution center, help, settings, language, legal, and dark/light appearance
- Creator business workspace with Home, Analytics, Products, Payments, Customers, Websites, Ads, Workforce, Affiliates, Cards, Support, Developer, and Settings pages
- Product catalog with search, visibility filters, archive/restore, edit routes, and CSV export
- Customer workspace with Customers, Memberships, and People tabs, filters, and CSV export
- Product editor with media preview, configurable INR pricing plans, checkout questions, inventory and access settings, headline/description, and FAQs
- Business profiles, products, pricing plans, and website links persist in relational Supabase tables; order and entitlement views are derived from those records

Profiles, businesses, products, pricing plans, orders, and memberships use the project's relational tables and row-level security. Profile name metadata is used only as a signup fallback; it is not an authorization or commerce data source. Sales analytics are derived from recorded paid orders; synthetic analytics samples carry `orders.is_demo = true` and are excluded from withdrawable balances. See `supabase/demo/cleanup_demo_sales.sql` to remove the current demo customers and sales later. Traffic, checkout conversion, refunds, disputes, and churn remain unavailable where the current schema has no event data. Real customer email is not shown because current RLS policies do not grant sellers access to buyer email. Choose and configure a payment provider before accepting real payments.

`.env` is git-ignored. Keep `SUPABASE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` server-only; the app does not use them in frontend code. The browser receives only the anon key. Those privileged keys were pasted into chat, so rotate them in Supabase and replace the local values.
