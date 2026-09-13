# TapCard

A mobile-first NFC ordering demo for small food businesses.

## Run locally

```bash
npm install
npm run dev
```

Demo routes:

- `/` — product landing page
- `/order/kape-ni-juan?table=T01` — customer menu and cart
- `/login` — staff sign-in
- `/dashboard/orders` — interactive staff order board

Demo staff credentials:

- Email: `staff@kapenijuan.ph`
- Password: `tapcard123`

## Supabase menu setup

The customer menu reads Supabase stores, table labels, categories, prices, and availability.
Merchants sign up at `/signup`, set up their store through a guided wizard, and manage it from
`/dashboard`. The cart is still a preview: online order submission is not implemented yet.

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` beside
   `package.json`. See `.env.example` for the names. Use a publishable key, never a secret
   or service-role key in a `VITE_` variable.
2. In your new Supabase development project, open **SQL Editor → New query**. Paste the
   entire contents of [`supabase/migrations/202609090001_public_menu.sql`](supabase/migrations/202609090001_public_menu.sql)
   and click **Run**. Run this migration once. It creates four tables and their read policies
   in one transaction; it is not an upgrade for a project that already has these tables.
3. Open another query, paste [`supabase/seed.sql`](supabase/seed.sql), and click **Run**.
   This creates Kape ni Juan, three categories, eight items, and tables T01–T03. Rerunning
   the seed does not overwrite existing prices or availability.
4. Open another query, paste [`supabase/migrations/202609100001_store_accounts.sql`](supabase/migrations/202609100001_store_accounts.sql),
   and click **Run**. This adds merchant accounts: the `store_staff` table, the `create_store`
   function signup uses, and owner-scoped write policies for menu items, categories, and tables.
5. In **Authentication → Sign In / Providers**, turn **off** "Confirm email" for this project.
   Signup is built to grant an active session immediately — leaving confirmation on will leave
   new accounts unable to log in until they confirm, silently breaking the signup flow.
6. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (see `.env.example`), then run
   `npm run seed:demo-account` once. This converts the existing Kape ni Juan demo store into a
   real account using the same credentials documented below.
7. Run `npm run check:supabase`. Expected: `Connected: Kape ni Juan — Table 01.` and
   `3 categories and 8 available menu items.` This command only reads public menu data.
8. Restart `npm run dev`, then open `/order/kape-ni-juan?table=T02`. Both the page and
   cart should say **Table 02**. Change a menu item's price in Supabase **Table Editor**
   and refresh to verify that the app uses the saved value.

Demo routes:

- `/` — product landing page
- `/order/kape-ni-juan?table=T01` — customer menu and cart
- `/signup` — merchant self-serve signup
- `/login` — merchant/staff sign-in
- `/onboarding` — guided store setup (store basics, menu items, tables)
- `/dashboard/orders` — staff order board (real store data; order-taking itself is not yet implemented)

Demo staff credentials (after running `npm run seed:demo-account`):

- Email: `staff@kapenijuan.ph`
- Password: `tapcard123`

For menu data outside the onboarding wizard, edit it in the Supabase dashboard, or sign in and
extend the wizard's insert calls — a full menu/tables editor page is a separate future addition.
Both signed-out and signed-in browser clients can only read active stores, active tables and
available menu items publicly; writes require store ownership via `store_staff`. Inactive stores
hide their categories, menu items and tables. Missing or invalid table codes show an error rather
than defaulting to Table 01.

If the check reports a missing schema, run the migrations and seed above. For permission
errors, verify the full migration ran, including grants and RLS policies. If requests cannot
reach the Data API, check **Integrations → Data API** is enabled and exposes `public`,
then check the project URL, publishable key and connection. Do not disable RLS to fix access.

## Verification

Use Node.js 22.18+ or 24+ for the test and connection-check scripts.

```bash
npm test
npm run build
npm run check:supabase
```

Tests execute the actual migrations and seed using an in-memory PostgreSQL engine (PGlite),
check public visibility and denied writes for both client roles, verify `create_store` and
owner-scoped write policies, and exercise the menu loader with the real Supabase client against
mock API responses. They do not modify your hosted database. The connection check separately
verifies the hosted API after you apply the SQL.
