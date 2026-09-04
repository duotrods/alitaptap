# TapCard Ordering System — One-Week MVP Plan

## Project Overview

**Working name:** TapCard

**Tagline:** Tap your phone on the table to open the menu and order — no camera scanning required.

TapCard is a mobile-first digital ordering system for small food businesses. Each table or counter has an inexpensive NFC sticker/card. When a customer taps an NFC-enabled phone on it, the phone opens that business's menu directly. The table number is included in the URL so the staff knows where the order belongs.

The first version is designed for cafes, food stalls, carinderias, and small restaurants in Davao del Norte. It is not a payment processor or a full POS system. Its core value is faster menu access, clearer orders, and a simple order board for staff.

## Problem Statement

QR menus require a customer to unlock a phone, open a camera or scanner, aim it at the code, wait for recognition, and then open the link. This can be inconvenient in low light, crowded spaces, or when hands are wet or busy.

Small food businesses also commonly need a simpler way to receive and manage customer orders without buying expensive POS hardware.

## Solution

A branded NFC table card contains an NDEF URL such as:

```text
https://tapcard.app/order/kape-ni-juan?table=T01
```

When a customer taps an NFC-enabled phone on the card:

1. The browser opens the specific business menu.
2. The application reads the store slug and table code from the URL.
3. The customer selects items and submits an order.
4. Staff sees the new order in real time, including its table number.
5. Staff moves the order through statuses: New, Preparing, Ready, Completed, or Cancelled.

Include a small printed QR code on every physical card as a fallback for phones without NFC or customers who prefer scanning.

## MVP Goal

Build and deploy a reliable demo in one week. The demo must prove this complete flow:

> Tap NFC table card -> Menu opens -> Customer orders -> Staff sees order -> Staff updates status -> Customer can view status.

## Users

### Customer

- Taps NFC card or scans backup QR code
- Views menu and item availability
- Adds items to cart
- Adds optional name and order note
- Submits order
- Sees order number and live status

### Staff

- Logs in to the merchant dashboard
- Sees incoming orders in real time
- Filters by order status
- Changes status: New -> Preparing -> Ready -> Completed
- Views table number, item list, quantities, and customer note

### Merchant Admin

- Logs in to a protected dashboard
- Creates and edits menu items
- Enables/disables item availability
- Creates table records and table NFC URLs
- Views daily order count, sales total, and top-selling items

## Non-Goals for Version 1

Do not build these in the first week:

- Payment processing, wallet balances, or handling customer funds
- GCash, Maya, or QR Ph API integration
- Full accounting, payroll, supplier management, or advanced inventory
- Delivery dispatch
- Loyalty points
- Customer accounts
- Native mobile apps
- Multi-branch management
- AI features

A merchant can display their existing GCash/Maya/QR Ph payment QR after the order is placed. Staff manually confirms payment in this MVP.

## Product Scope

### Public Pages

1. `/`
   - Simple landing page
   - Explains: Tap, browse, order
   - Demo call-to-action

2. `/order/[storeSlug]?table=[tableCode]`
   - Store name and logo
   - Table identifier when present
   - Category filter
   - Available menu items
   - Cart drawer or checkout section
   - Customer name (optional)
   - Order note (optional)
   - Submit order button

3. `/order-status/[orderCode]`
   - Order number
   - Status timeline: New, Preparing, Ready, Completed
   - Table number
   - Order summary

### Merchant Pages

1. `/login`
   - Merchant/staff sign-in

2. `/dashboard`
   - Today's order count
   - Today's sales total
   - New orders count
   - Recent orders

3. `/dashboard/orders`
   - Real-time kitchen/order board
   - Columns or filters: New, Preparing, Ready, Completed
   - Status update action

4. `/dashboard/menu`
   - Add/edit menu items
   - Name, category, description, price, image URL optional, available toggle

5. `/dashboard/tables`
   - Add table code and label
   - Generate NFC URL
   - Generate/download printable card layout later; for MVP show the URL clearly

## Core User Flows

### Customer order flow

1. Customer taps a TapCard on a table.
2. Browser opens `/order/kape-ni-juan?table=T01`.
3. Customer selects menu items and quantities.
4. Customer opens cart, enters optional name and note, and submits.
5. System creates an order with status `new`.
6. Customer receives an order code and is redirected to its status page.
7. Staff dashboard receives the new order in real time.

### Staff fulfillment flow

1. Staff opens `/dashboard/orders`.
2. A new order appears in the `New` column.
3. Staff opens the order details.
4. Staff changes status to `preparing`.
5. When done, staff changes status to `ready`.
6. Customer status page updates in real time.
7. Staff marks the order `completed` after serving it.

### Merchant onboarding flow

1. Merchant admin creates a store and menu.
2. Merchant admin adds tables: `T01`, `T02`, `Counter`.
3. System provides one URL per table.
4. Admin writes each URL to an NFC tag using an NFC-writing app.
5. Admin places the physical card/sticker at the table.

## Technical Stack

Use tools optimized for fast development and deployment.

- **Frontend:** React + Vite + TypeScript
- **UI:** Tailwind CSS
- **Backend/database/auth/realtime:** Supabase
- **Hosting:** Vercel, Cloudflare Pages, or Netlify
- **NFC:** NTAG213 or NTAG215 NFC stickers/cards encoded with an NDEF URL
- **Optional maps/analytics:** Not needed for MVP

Use the customer's phone browser. No customer app installation is required.

## NFC Implementation

### Recommended physical tag

- Start with **NTAG213** stickers for the MVP. They have enough capacity for a short URL.
- Use **NTAG215** only if you want extra memory or already have them.
- Put the tag inside a laminated table card, acrylic stand, or sticker with a clear instruction: `Tap your phone here to order`.

### URL structure

Use short production URLs to make the NFC record compact:

```text
https://tapcard.ph/o/kape-ni-juan?t=T01
```

For local development/testing, use a deployed HTTPS preview URL. NFC browser opening is more reliable with HTTPS.

### Writing the card

1. Install an NFC writing app, such as NFC Tools, on an NFC-enabled Android phone.
2. Choose `Write` then `Add a record` then `URL / URI`.
3. Paste the table-specific URL.
4. Write the record to the NFC tag.
5. Tap the tag with an Android and an iPhone, if available, to confirm that the menu opens.
6. Print a QR code pointing to the exact same URL as a fallback.

### Security note

For the MVP, tags only hold a public URL. Do not store payment data, passwords, customer data, or private API keys in the NFC tag.

A copied tag can only open the public menu, which is acceptable. In a future version, use a signed table token if abuse becomes a concern.

## Database Design

Use Supabase PostgreSQL. Use UUID IDs and timestamps.

```sql
create type public.order_status as enum (
  'new',
  'preparing',
  'ready',
  'completed',
  'cancelled'
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  slug text unique not null,
  logo_url text,
  created_at timestamptz not null default now()
);

create table public.store_staff (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (store_id, code)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  table_id uuid references public.tables(id) on delete set null,
  order_code text not null unique,
  customer_name text,
  customer_note text,
  status public.order_status not null default 'new',
  subtotal numeric(10,2) not null check (subtotal >= 0),
  total numeric(10,2) not null check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(10,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table public.tap_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  table_id uuid references public.tables(id) on delete set null,
  created_at timestamptz not null default now()
);
```

## Data and Security Rules

### Public access

Public users must be able to:

- Read a store by slug
- Read available menu items for a public store
- Read active table records only when needed to validate a table code
- Create an order only through a validated server-side action or Supabase Edge Function
- Read only the one order-status record they just created, preferably through an unguessable `order_code`

### Merchant access

Authenticated staff must only access stores where they have a row in `store_staff`.

They can:

- Read and update their store's orders
- Read and manage their own store's menu, tables, and categories
- View their own store's tap events

### Important implementation rule

Do not let anonymous users insert arbitrary `store_id`, item price, total, or order status directly into the database. Use a server action, API route, or Supabase Edge Function named `create-order` that:

1. Receives `storeSlug`, `tableCode`, cart item IDs, quantities, name, and note.
2. Looks up current available menu items and prices on the server.
3. Calculates totals on the server.
4. Validates the table belongs to the store and is active.
5. Creates the order and order items atomically.
6. Returns only the order code.

## Suggested API / Server Actions

### Public

- `GET /api/stores/:slug/menu`
- `POST /api/orders`
  - Input: store slug, table code, customer name, note, cart line items
  - Output: order code, order status URL
- `POST /api/taps`
  - Input: store slug, table code
  - Records only a basic event; do not require personal data

### Merchant

- `PATCH /api/orders/:id/status`
- `POST /api/menu-items`
- `PATCH /api/menu-items/:id`
- `POST /api/tables`
- `GET /api/dashboard/summary`

If using Supabase directly for merchant actions, use RLS policies. Keep public order creation server-side.

## Frontend Components

### Customer components

- `StoreHeader`
- `CategoryTabs`
- `MenuItemCard`
- `CartDrawer`
- `CartLineItem`
- `CheckoutForm`
- `OrderStatusTracker`
- `FallbackQrNotice` (only in printed card instructions, not necessarily web UI)

### Dashboard components

- `DashboardStats`
- `OrderBoard`
- `OrderCard`
- `OrderDetailsModal`
- `StatusBadge`
- `MenuEditor`
- `TableManager`
- `NfcUrlCard`

## One-Week Build Schedule

### Day 1 — Setup and data model

- Create the React + Vite + TypeScript project.
- Configure Tailwind CSS.
- Create a Supabase project.
- Add the database schema.
- Create one test store: `Kape ni Juan`.
- Add 6–10 sample menu items and 3 test tables.
- Set up environment variables and deployment.

**Deliverable:** A deployed placeholder app connected to Supabase.

### Day 2 — Customer menu and cart

- Build `/order/[storeSlug]`.
- Read `table` from the query parameter.
- Display available menu items.
- Implement cart add, remove, quantity controls, and totals.
- Make the interface mobile-first.

**Deliverable:** Customer can browse a store's menu and build a cart.

### Day 3 — Secure order creation

- Build `POST /api/orders` or a Supabase Edge Function.
- Validate cart items, prices, availability, store, and table server-side.
- Insert `orders` and `order_items` in one transaction.
- Generate an order code, for example `KJ-4821`.
- Redirect to `/order-status/[orderCode]`.

**Deliverable:** A complete order can be submitted and stored safely.

### Day 4 — Staff dashboard

- Add Supabase email/password authentication for demo staff.
- Build `/dashboard/orders`.
- Show current orders and their details.
- Add status updates.
- Add Supabase Realtime subscriptions for order inserts and status changes.

**Deliverable:** Staff receives and manages incoming orders live.

### Day 5 — NFC cards and table management

- Build `/dashboard/tables`.
- Generate table-specific URLs.
- Buy or prepare 3–5 NFC stickers/cards.
- Encode URLs using an NFC-writing app.
- Add QR-code fallback to the printed/card design.
- Test the tap experience on at least two phones if possible.

**Deliverable:** Tapping a physical table card opens the correct menu and table.

### Day 6 — Dashboard summary and polish

- Add dashboard stats: today's orders, today's sales, new orders, top items.
- Build simple menu management or seed menu data if time is tight.
- Add loading, error, empty, and success states.
- Improve button sizes, contrast, and mobile layout.
- Add a short landing page explaining the value proposition.

**Deliverable:** Polished end-to-end demo.

### Day 7 — Test, record, and pitch

- Test: NFC tap -> order -> real-time dashboard -> status update.
- Test failure cases: unavailable item, invalid table, empty cart, lost internet connection message.
- Prepare backup QR codes in case NFC is unavailable during a live demo.
- Record a 60–90 second demo video.
- Capture screenshots for the startup submission.
- Prepare pitch copy and honest pilot plan.

**Deliverable:** Deployed MVP, physical demo card, pitch-ready screenshots/video.

## Acceptance Criteria

The MVP is complete when all of these are true:

- An NFC table tag opens the correct deployed ordering URL.
- The URL contains a valid store and table code.
- A customer can add multiple items, change quantities, and submit an order.
- The server calculates totals based on database prices.
- The order stores its items and table reference.
- Staff can see a new order without refreshing the dashboard.
- Staff can update order status.
- The customer status page reflects the updated order status.
- A QR fallback opens the same URL.
- All public URLs use HTTPS.

## Demo Script

1. Show a branded TapCard at a table with the text: `Tap your phone to order`.
2. Tap an NFC-enabled phone on the card.
3. Show the menu opening instantly for `Table 01`.
4. Add two items and submit the order.
5. Switch to the staff order board and show the new order arriving.
6. Change it from `New` to `Preparing`, then `Ready`.
7. Return to the customer order-status page and show the live update.
8. End with the business value: faster ordering, fewer errors, no new hardware for customers, and simple tools for small businesses.

## Startup Positioning

### Customer segment

Start with independent cafes, food stalls, carinderias, milk-tea stores, food-court tenants, and small restaurants in Tagum and Panabo.

### Value proposition

> TapCard gives small food businesses a faster, branded alternative to camera-based QR menus: customers tap a table card to order, while staff receive clear, table-linked orders in real time.

### Revenue hypotheses

- One-time TapCard/table-kit setup fee: PHP 500–1,500 per outlet, depending on number and finish of cards.
- Monthly software subscription: PHP 299–799 per branch for ordering and dashboard access.
- Optional merchant onboarding: PHP 1,000–3,000 for menu setup, staff training, and physical installation.

Validate these prices through interviews before presenting them as final.

## Validation Questions for Businesses

Talk to at least 5–10 food-business owners or managers before the submission.

- How are orders taken during busy periods today?
- What causes the most order errors or delays?
- Do customers currently use QR menus or online ordering?
- Would customers be comfortable tapping a table card to open a menu?
- How many tables or ordering points would need cards?
- What monthly amount would feel reasonable for a simple ordering system?
- Would the business agree to a short pilot?

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Some customers do not have NFC enabled or compatible phones | Put a QR code on the same card as an always-available fallback |
| NFC opens the menu but does not improve actual ordering speed | Measure tap-to-order completion and simplify the menu/cart flow |
| Tags are removed, damaged, or rewritten | Use laminated/acrylic mounts, keep replacement tags, and lock NFC tag memory after testing |
| Staff ignores the dashboard | Use a visible tablet/phone order board and a simple new-order sound notification |
| Internet is weak | Show clear retry states; later add PWA caching/offline queue, but do not promise this in MVP |
| Established QR/POS competitors exist | Focus on small local businesses, fast setup, NFC-first table experience, and local onboarding/support |

## Future Roadmap

After validation, consider:

- GCash/Maya/QR Ph payment confirmation workflow
- Kitchen display mode and sound alerts
- Item modifiers, such as size, add-ons, spice level, or sugar level
- Basic inventory deduction
- Customer loyalty and repeat-order shortcuts
- Multiple branches and business analytics
- Merchant-branded card designs and printed table stands
- Offline-first/PWA support
- Cebuano, Filipino, and English interface options

## Instructions for Claude

Build this as a production-minded but tightly scoped MVP. Prioritize a working end-to-end flow over feature count. Use TypeScript, React + Vite, Tailwind CSS, and Supabase. Use server-side or Edge Function order creation to prevent client-side price manipulation. Make the customer ordering page extremely mobile-friendly. Use Supabase Realtime for staff order updates and customer order-status updates. Do not build payment processing, loyalty, inventory, multi-branch support, AI, or native mobile apps in the first iteration.

Start by generating:

1. A file/folder architecture.
2. Supabase SQL migrations, including RLS policies and a secure `create-order` function or Edge Function.
3. A seed script for one demo store, categories, menu items, and tables.
4. The customer ordering flow.
5. The protected merchant order board.
6. NFC URL generation in the table-management screen.
7. Deployment and environment-variable instructions.
