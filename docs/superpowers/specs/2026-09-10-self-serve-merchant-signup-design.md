# Self-Serve Merchant Signup — Design Spec

Date: 2026-09-10

## Context

TapCard's ordering plan (`tapcard-ordering-system-plan.md`) was written for a single hardcoded
demo store ("Kape ni Juan"). The staff login is a client-side check against a hardcoded
email/password, session state lives in `localStorage`, and the dashboard shows fake demo data.

This spec covers turning that into a multi-tenant foundation: any merchant can sign up, create
their own store through a guided wizard, and log in to a dashboard scoped to only their own data.

**Out of scope for this spec** (separate future sub-projects):
- Real order creation (`orders`/`order_items` tables, `create-order` server action, `/order-status/[code]`).
- A full-featured `/dashboard/menu` editor (edit/delete/availability toggle/images) beyond what the
  onboarding wizard needs to create the first few items.
- A full-featured `/dashboard/tables` manager beyond what the wizard needs.
- Billing/subscriptions, marketing/pricing pages, inviting additional staff per store.

## Decisions locked in during brainstorming

- Scope is **self-serve signup only** — not billing, not a marketing redesign, not multi-staff-per-store.
- After signup, the merchant goes through a **guided setup wizard** (not a bare empty dashboard).
- **One owner account per store** for now (`store_staff.role` still models `'owner'`/`'staff'` so
  inviting teammates later doesn't require a schema change).
- **Email confirmation is skipped** — signup grants an active session immediately, for a fast
  demo/pitch flow. Revisit before a real public launch.
- The existing **Kape ni Juan demo store is converted** into a real seeded Supabase Auth account
  (same email/password as today), going through the same data model as any other merchant, rather
  than being deleted or left on a separate hardcoded path.
- Store creation happens through a **`security definer` Postgres RPC function**, not client-side
  sequential inserts, to avoid a privilege-escalation hole where a client could otherwise insert
  itself as `store_staff` owner of an existing store it doesn't own.
- The wizard's menu/tables steps are **skippable, with a dashboard nudge banner** afterward rather
  than blocking progress until at least one item/table exists.

## Operational prerequisite

"Confirm email" is a toggle in the Supabase project's **Authentication → Sign In / Providers**
settings, not something a migration can control. Whoever runs this must turn it **off** in the
hosted project dashboard before signup will grant an instant session as designed. README gets a
step calling this out explicitly, since skipping it would silently leave new signups unconfirmed
and unable to log in.

## Data model & security

New migration: `supabase/migrations/<timestamp>_store_accounts.sql`.

### `store_staff` table

```sql
create table public.store_staff (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

alter table public.store_staff enable row level security;

revoke all on public.store_staff from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.store_staff to authenticated;
grant all on public.store_staff to service_role;

create policy "Owners can read their own membership" on public.store_staff
  for select to authenticated using (user_id = auth.uid());
```

No `insert`/`update`/`delete` grant to `authenticated` — the only way to create a `store_staff` row
as a normal user is through `create_store()` below. `service_role` (used by the demo-account seed
script) can still write directly.

### `create_store` RPC function

```sql
create function public.create_store(store_name text, store_slug text)
returns public.stores
language plpgsql
security definer
set search_path = public
as $$
declare
  new_store public.stores;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to create a store';
  end if;

  if length(trim(store_name)) = 0 then
    raise exception 'Store name is required';
  end if;

  if store_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Store link must be lowercase letters, numbers, and hyphens';
  end if;

  insert into public.stores (name, slug)
  values (trim(store_name), store_slug)
  returning * into new_store;

  insert into public.store_staff (store_id, user_id, role)
  values (new_store.id, auth.uid(), 'owner');

  return new_store;
end;
$$;

revoke all on function public.create_store(text, text) from public;
grant execute on function public.create_store(text, text) to authenticated;
```

A duplicate `store_slug` raises a Postgres unique-violation (`23505`), which the client catches and
turns into "That link is taken — try another."

### Write policies for owner-managed data

Add `insert`/`update`/`delete` grants (currently only `select` is granted to `authenticated`/`anon`)
plus matching RLS policies for `stores`, `categories`, `menu_items`, and `tables`, all scoped through
`store_staff` membership:

```sql
grant insert, update, delete on public.categories, public.menu_items, public.tables to authenticated;
grant update on public.stores to authenticated;

create policy "Owners manage their store" on public.stores
  for update to authenticated
  using (id in (select store_id from public.store_staff where user_id = auth.uid()));

create policy "Owners manage their categories" on public.categories
  for all to authenticated
  using (store_id in (select store_id from public.store_staff where user_id = auth.uid()))
  with check (store_id in (select store_id from public.store_staff where user_id = auth.uid()));

create policy "Owners manage their menu items" on public.menu_items
  for all to authenticated
  using (store_id in (select store_id from public.store_staff where user_id = auth.uid()))
  with check (store_id in (select store_id from public.store_staff where user_id = auth.uid()));

create policy "Owners manage their tables" on public.tables
  for all to authenticated
  using (store_id in (select store_id from public.store_staff where user_id = auth.uid()))
  with check (store_id in (select store_id from public.store_staff where user_id = auth.uid()));
```

(The existing public read-only policies from the first migration are unaffected — these are
additive `insert`/`update`/`delete` policies alongside them.)

## Signup + auth flow

### `/signup` (new page)

- Same two-column visual pattern as the existing `/login` page.
- Fields: email, password. Relies on Supabase's own password rules — no custom validation beyond
  "not empty."
- `supabase.auth.signUp({ email, password })`. Since confirmation is disabled project-side, this
  returns an active session immediately.
- Success → `go('/onboarding')`.
- Failure (e.g. email already registered) → inline error, same style as `LoginPage`'s error message.
- Link to `/login` for existing accounts.

### `/login` rework

- Replace the hardcoded `DEMO_EMAIL`/`DEMO_PASSWORD` check and `SESSION_KEY` localStorage flag with
  `supabase.auth.signInWithPassword({ email, password })`.
- After a successful sign-in, query `store_staff` joined to `stores` for the current user:
  - No row → `go('/onboarding')`.
  - Row found → `go('/dashboard')`.
- Add a "Don't have an account? Sign up" link (and the reverse on `/signup`).
- The demo-credentials hint box can stay, since the Kape ni Juan account will be a real login.

### App-level session handling

- `App()` drops `hasStaffSession()`/the `authenticated` boolean in favor of real Supabase session
  state: read once via `supabase.auth.getSession()` on mount, kept current via
  `supabase.auth.onAuthStateChange`.
- Once a session exists, resolve the owned store (id, slug, name) via the `store_staff` → `stores`
  join and hold it alongside the session.
- Route guards:
  - `/dashboard*` or `/onboarding` with no session → `/login`.
  - `/dashboard*` with a session but no store yet → `/onboarding`.
  - `/onboarding` with a session and a store whose menu items and tables are both non-empty →
    `/dashboard` (no re-running the full wizard from scratch once complete; resuming an
    incomplete store is still allowed — see below).
- Sign out calls `supabase.auth.signOut()` instead of clearing `localStorage`.

## Onboarding wizard (`/onboarding`)

Single component, three steps tracked as local state (no routing library needed — consistent with
the rest of the app's plain pathname-based routing).

**Step 1 — Store basics (required):**
- Field: store name. Slug auto-derives (lowercase, non-alphanumeric → hyphen, collapsed/trimmed) and
  is shown as an editable "Your menu link will be `/order/<slug>`" field.
- Submits via `supabase.rpc('create_store', { store_name, store_slug })`.
- Unique-violation error → "That link is taken — try another," stays on Step 1.
- Success stores `{ id, slug }` in wizard state, advances to Step 2.

**Step 2 — Menu items (skippable):**
- Repeating mini-form: item name, price, category (free-text; first use for a given name creates a
  `categories` row for this store, reused after that).
- "Add item" inserts directly into `categories`/`menu_items` scoped to the new store (allowed by the
  RLS policies above).
- "Skip for now" and "Continue" both advance to Step 3.

**Step 3 — Tables (skippable):**
- Prefilled suggestions: `T01`/`Table 01`, `T02`/`Table 02`, `Counter` — each removable, plus
  "add another" for custom code/label pairs.
- "Finish setup" inserts the remaining rows into `tables`; skipping proceeds with none.

**Resuming:** navigating to `/onboarding` when a store already exists jumps to the first step with
nothing in it yet (no items → Step 2; has items but no tables → Step 3; has both → redirect to
`/dashboard`, per the route guard above).

**Finish:** redirect to `/dashboard`.

## Dashboard changes

- **Store-aware branding:** sidebar/header/avatar-initials derive from the real logged-in store's
  name instead of the hardcoded "Kape ni Juan"/"Juan"/"KJ".
- **Honest zero-state:** the `initialOrders` demo array and hardcoded stats (`24` orders, `₱3,840`,
  etc.) are removed. Every store — including the converted Kape ni Juan account — shows `0`
  orders/`₱0` sales and an empty order board ("No orders yet — orders will appear here once
  customers start ordering") until the future order-creation sub-project wires up real data. This
  is a necessary trim, not new scope: fake data shared identically across every merchant is a bug
  in a multi-tenant app.
- **Setup nudge banner:** dismissible-per-session banner shown when the store has zero menu items or
  zero tables, linking back to `/onboarding` to resume.
- **Sign out:** uses `supabase.auth.signOut()`.

## Converting the Kape ni Juan demo account

New one-time script `scripts/seed-demo-account.mjs` (same shape as `scripts/check-supabase.mjs`),
run manually against the hosted project:

1. Uses a **service-role key** (server-only env var, e.g. `SUPABASE_SERVICE_ROLE_KEY` — never
   `VITE_`-prefixed, so it never reaches the client bundle) to call
   `supabase.auth.admin.createUser()` for `staff@kapenijuan.ph` / `tapcard123` (same credentials the
   README already documents).
2. Inserts a `store_staff` row linking that user to the existing `kape-ni-juan` store as `'owner'`,
   via the service-role client (bypassing `create_store()`, since the store already exists).

README gets a short new step documenting this script and its required env var.

## Testing

- Extend the existing PGlite-based migration tests (pattern from the current test suite) to cover:
  - `create_store()` succeeds for an authenticated user and creates both rows atomically.
  - `create_store()` rejects a duplicate slug.
  - `create_store()` rejects when not authenticated.
  - A non-owner cannot `insert`/`update`/`delete` another store's `categories`/`menu_items`/`tables`.
  - An owner *can* manage their own store's `categories`/`menu_items`/`tables`.
- Manual verification: sign up a new account end-to-end through the wizard (including skipping
  steps and resuming), confirm dashboard zero-state and nudge banner, confirm the converted Kape ni
  Juan login still works with its existing credentials.

## File-level summary of changes

- `supabase/migrations/<timestamp>_store_accounts.sql` — new (schema + RLS + RPC above).
- `scripts/seed-demo-account.mjs` — new.
- `src/lib/supabase.ts` or a new `src/lib/auth.ts` — session helpers (get session, resolve owned
  store, sign out).
- `src/App.tsx` — session-based routing, drop `localStorage` auth, wire `/signup` and `/onboarding`.
- New `src/Signup.tsx`, `src/Onboarding.tsx` (or equivalent) — signup page and wizard.
- `src/App.tsx` (`Dashboard`) — store-aware branding, zero-state, nudge banner, real sign-out.
- `.env.example` — document the new server-only service-role env var (for the seed script only).
- `README.md` — document signup flow and the demo-account seed script.
- `tests/*.test.mjs` — new coverage per the Testing section above.
