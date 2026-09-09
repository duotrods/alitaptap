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

The customer menu now reads Supabase stores, table labels, categories, prices, and availability.
The cart is a preview: online order submission is not implemented yet. Staff login and the
order board still use demo data and are not connected to Supabase Auth or saved orders.

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
4. Run `npm run check:supabase`. Expected: `Connected: Kape ni Juan — Table 01.` and
   `3 categories and 8 available menu items.` This command only reads public menu data.
5. Restart `npm run dev`, then open `/order/kape-ni-juan?table=T02`. Both the page and
   cart should say **Table 02**. Change a menu item's price in Supabase **Table Editor**
   and refresh to verify that the app uses the saved value.

For this milestone, edit menu data in the Supabase dashboard. Both signed-out and signed-in
browser clients can only read active stores, active tables and available menu items. Browser
writes are denied; staff membership and write policies will be added with real staff authentication.
Inactive stores hide their categories, menu items and tables. Missing or invalid table codes
show an error rather than defaulting to Table 01.

If the check reports a missing schema, run the migration and seed above. For permission
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

Tests execute the actual migration and seed using an in-memory PostgreSQL engine (PGlite),
check public visibility and denied writes for both client roles, and exercise the menu loader
with the real Supabase client against mock API responses. They do not modify your hosted database.
The connection check separately verifies the hosted API after you apply the SQL.
