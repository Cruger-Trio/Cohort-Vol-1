# Gully — India’s creator marketplace

A responsive creator marketplace MVP with Supabase email authentication and a signed-in user portal.

## Run locally

Node.js 22+ is required. Start the server from this folder:

```powershell
node --env-file=.env server.mjs
```

Open [http://localhost:4173](http://localhost:4173). The server reads `.env`, returns only the Supabase URL and anon key from `/api/public-config`, and never serves dotfiles.

## Auth and personal portal

- Email/password signup and login, email confirmation, password reset, persistent sessions, and sign-out
- Profile identity with editable name, username, location, bio, and cover color
- Created/Joined profile tabs, profile editing, and a business workspace switcher
- Personal portal sections for orders, messages, partners, affiliates, workforce, communities, resolution center, help, settings, language, legal, and dark/light appearance
- Creator business workspace with Home, Analytics, Products, Payments, Customers, Websites, Ads, Workforce, Affiliates, Cards, Support, Developer, and Settings pages
- Product catalog with search, visibility filters, archive/restore, edit routes, and CSV export
- Customer workspace with Customers, Memberships, and People tabs, filters, and CSV export
- Product editor with media preview, configurable INR pricing plans, checkout questions, inventory and access settings, headline/description, and FAQs
- Business settings, product drafts, pricing, FAQs, and website links persist in Supabase Auth user metadata

Display-only profile fields and MVP business/product drafts are stored in Supabase Auth user metadata via the authenticated user update flow. This metadata is user-editable and is used only to render the signed-in creator workspace; never use it for authorization or access control. The business dashboard starts at zero balances. Local media uploads are session previews; stock image selections persist as URLs. Payments, payouts, customer records, followers, team access, affiliate attribution, AI copy generation, and live storefront publishing remain placeholders until provider integrations and protected database tables with row-level security are added.

`.env` is git-ignored. Keep `SUPABASE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` server-only; the app does not use them in frontend code. The browser receives only the anon key. Those privileged keys were pasted into chat, so rotate them in Supabase and replace the local values.
