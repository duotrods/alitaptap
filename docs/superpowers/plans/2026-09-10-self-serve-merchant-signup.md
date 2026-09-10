# Self-Serve Merchant Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hardcoded "Kape ni Juan" demo login with real Supabase-Auth-backed, self-serve merchant signup: any business can sign up, create their own store through a guided wizard, and manage it in a dashboard scoped to only their own data.

**Architecture:** A `security definer` Postgres RPC (`create_store`) atomically creates a store and its owner's `store_staff` row so no client code is ever trusted to grant itself ownership of someone else's store. RLS policies scope all merchant writes (menu items, categories, tables, store details) to rows the caller owns via `store_staff`. The React app drops its `localStorage`-based fake session for real Supabase Auth session state, adds `/signup` and `/onboarding` routes, and the dashboard becomes store-aware instead of hardcoded.

**Tech Stack:** React + Vite + TypeScript, Supabase (Postgres + Auth + RLS), Node's built-in test runner with PGlite for migration tests, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-self-serve-merchant-signup-design.md`

**A note on `lib/supabase.ts`:** today, `src/lib/supabase.ts` creates its client eagerly at module scope and throws if the env vars are missing. `OrderPage` already works around this with a dynamic `await import('./lib/supabase')`, so the landing page never pays for a Supabase client it doesn't need. This plan adds several more components that need a Supabase client (`Signup`, `Onboarding`, `LoginPage`, `Dashboard`) — if they statically imported today's `lib/supabase.ts`, the eager throw would run the moment `App.tsx` loads, breaking the landing page for anyone without `.env.local` configured. Task 5 fixes this at the source (lazy client creation) so every later task can import it safely and statically.

---

## Task 1: Migration — `store_staff`, `create_store`, and owner write policies

**Files:**
- Create: `supabase/migrations/202609100001_store_accounts.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Run once after 202609090001_public_menu.sql. Adds merchant accounts:
-- store_staff membership, a security-definer create_store() function, and
-- owner-scoped write policies for stores, categories, menu_items and tables.
begin;

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

-- Runs with the privileges of the function owner (the migration role, which
-- owns public.stores/public.store_staff), so it bypasses RLS entirely for its
-- own two inserts. No INSERT grant is given to authenticated on either table —
-- this function is the only way a normal user can create a store or become
-- its owner, closing the privilege-escalation hole a client-side insert would
-- otherwise open.
create or replace function public.create_store(store_name text, store_slug text)
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

notify pgrst, 'reload schema';
commit;
```

This is additive: the existing public read-only policies from `202609090001_public_menu.sql` are untouched. The `for all` policies above add owner-scoped insert/update/delete alongside the existing public `select` policies — Postgres OR's multiple permissive policies for the same table together.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/202609100001_store_accounts.sql
git commit -m "$(cat <<'EOF'
Add store_staff, create_store RPC, and owner write policies

Lays the multi-tenant foundation: a security-definer function is the
only way to create a store and its owner link, so no client insert can
grant itself ownership of an existing store.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migration tests

**Files:**
- Create: `tests/store-accounts.test.mjs`

The existing `tests/menu-schema.test.mjs` emulates Supabase's `anon`/`authenticated`/`service_role` roles with a `before()` hook. This migration also needs `auth.users` and `auth.uid()`, which real Supabase provides but vanilla PGlite doesn't — this test file creates a minimal stand-in for both, matching Supabase's actual `auth.uid()` definition (reads `sub` from `request.jwt.claims`).

- [ ] **Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const seed = await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8')

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid());
    grant usage on schema auth to anon, authenticated;
    grant select on auth.users to anon, authenticated;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
    $$;
  `)
  await db.exec(await readFile(new URL('../supabase/migrations/202609090001_public_menu.sql', import.meta.url), 'utf8'))
  await db.exec(seed)
  await db.exec(await readFile(new URL('../supabase/migrations/202609100001_store_accounts.sql', import.meta.url), 'utf8'))
})

after(async () => { await db.close() })

async function asRole(role, callback) {
  await db.exec(`set role ${role}`)
  try { return await callback() } finally { await db.exec('reset role') }
}

async function asUser(userId, callback) {
  await db.exec('set role authenticated')
  await db.exec(`set request.jwt.claims = '${JSON.stringify({ sub: userId })}'`)
  try { return await callback() } finally {
    await db.exec('reset request.jwt.claims')
    await db.exec('reset role')
  }
}

async function createAuthUser() {
  const { rows } = await db.query('insert into auth.users default values returning id')
  return rows[0].id
}

test('create_store requires an authenticated caller', async () => {
  await asRole('anon', async () => {
    await assert.rejects(
      db.exec("select public.create_store('Milk Tea Stop', 'milk-tea-stop')"),
      error => /must be signed in/i.test(error.message),
    )
  })
})

test('create_store atomically creates a store and its owner membership', async () => {
  const userId = await createAuthUser()
  await asUser(userId, async () => {
    const { rows } = await db.query("select * from public.create_store('Milk Tea Stop', 'milk-tea-stop')")
    assert.equal(rows[0].slug, 'milk-tea-stop')
    const membership = await db.query(
      'select role from public.store_staff where store_id = $1 and user_id = $2',
      [rows[0].id, userId],
    )
    assert.equal(membership.rows[0].role, 'owner')
  })
})

test('create_store rejects a duplicate slug', async () => {
  const userId = await createAuthUser()
  await asUser(userId, async () => {
    await assert.rejects(
      db.exec("select public.create_store('Copycat', 'kape-ni-juan')"),
      error => error.code === '23505',
    )
  })
})

test('an owner can manage their own store menu but not another store', async () => {
  const ownerId = await createAuthUser()
  const otherOwnerId = await createAuthUser()
  const myStore = await asUser(ownerId, async () => {
    const { rows } = await db.query("select * from public.create_store('My Cafe', 'my-cafe')")
    return rows[0]
  })
  const otherStore = await asUser(otherOwnerId, async () => {
    const { rows } = await db.query("select * from public.create_store('Other Cafe', 'other-cafe')")
    return rows[0]
  })
  await asUser(ownerId, async () => {
    await db.query('insert into public.categories (store_id, name) values ($1, $2)', [myStore.id, 'Drinks'])
    await assert.rejects(
      db.query('insert into public.categories (store_id, name) values ($1, $2)', [otherStore.id, 'Hacked']),
      error => error.code === '42501',
    )
  })
})

test('signed-out and other authenticated users still cannot write menu data directly', async () => {
  const outsiderId = await createAuthUser()
  await asUser(outsiderId, async () => {
    await assert.rejects(
      db.query("insert into public.tables (store_id, code, label) select id, 'T99', 'Ghost table' from public.stores where slug = 'kape-ni-juan'"),
      error => error.code === '42501',
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/store-accounts.test.mjs`
Expected: FAIL — `supabase/migrations/202609100001_store_accounts.sql` doesn't exist yet at this point if Task 1 wasn't done first. Since Task 1 is already complete, instead confirm they currently **pass**; if any fails, the migration in Task 1 has a bug — fix `202609100001_store_accounts.sql` before continuing (do not weaken the test).

- [ ] **Step 3: Run the full existing suite to confirm no regressions**

Run: `npm test`
Expected: All tests in `tests/menu-schema.test.mjs`, `tests/menu-loader.test.mjs`, and the new `tests/store-accounts.test.mjs` pass.

- [ ] **Step 4: Commit**

```bash
git add tests/store-accounts.test.mjs
git commit -m "$(cat <<'EOF'
Add PGlite tests for create_store and owner write policies

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `slugify` helper

**Files:**
- Create: `src/lib/slug.ts`
- Test: `tests/slug.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { slugify } from '../src/lib/slug.ts'

test('lowercases and hyphenates spaces', () => {
  assert.equal(slugify('Kape ni Juan'), 'kape-ni-juan')
})

test('collapses repeated separators and trims edges', () => {
  assert.equal(slugify('  Milk & Tea!! Stop  '), 'milk-tea-stop')
})

test('keeps digits', () => {
  assert.equal(slugify('Store 24'), 'store-24')
})

test('an empty or symbols-only name slugifies to an empty string', () => {
  assert.equal(slugify(''), '')
  assert.equal(slugify('!!!'), '')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/slug.test.mjs`
Expected: FAIL with "Cannot find module '../src/lib/slug.ts'" or similar.

- [ ] **Step 3: Write the implementation**

```typescript
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/slug.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts tests/slug.test.mjs
git commit -m "$(cat <<'EOF'
Add slugify helper for deriving store links from names

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `getOwnedStore` / `getStoreSetupCounts` helpers

**Files:**
- Create: `src/lib/store.ts`
- Test: `tests/store.test.mjs`

These take a `SupabaseClient` as a parameter rather than importing one, so they stay decoupled from Task 5's client-creation change and are trivial to test with a mocked client.

- [ ] **Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { getOwnedStore, getStoreSetupCounts } from '../src/lib/store.ts'

function fixture(overrides = {}) {
  const requests = []
  const data = {
    store_staff: [{ stores: { id: 'store-1', slug: 'milk-tea-stop', name: 'Milk Tea Stop' } }],
    menu_items: [],
    tables: [],
    ...overrides,
  }
  const client = createClient('https://test.supabase.co', 'test-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(input)
      requests.push(url)
      const value = data[url.pathname.split('/').at(-1)]
      return Response.json(value, { status: 200 })
    } },
  })
  return { client, requests }
}

test('getOwnedStore returns the linked store', async () => {
  const { client } = fixture()
  const store = await getOwnedStore(client)
  assert.deepEqual(store, { id: 'store-1', slug: 'milk-tea-stop', name: 'Milk Tea Stop' })
})

test('getOwnedStore returns null when the user owns no store', async () => {
  const { client } = fixture({ store_staff: [] })
  const store = await getOwnedStore(client)
  assert.equal(store, null)
})

test('getStoreSetupCounts reports zero for a fresh store', async () => {
  const { client } = fixture()
  const counts = await getStoreSetupCounts(client, 'store-1')
  assert.deepEqual(counts, { menuItemCount: 0, tableCount: 0 })
})

test('getStoreSetupCounts counts existing rows', async () => {
  const { client } = fixture({ menu_items: [{ id: 'a' }, { id: 'b' }], tables: [{ id: 'c' }] })
  const counts = await getStoreSetupCounts(client, 'store-1')
  assert.deepEqual(counts, { menuItemCount: 2, tableCount: 1 })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/store.test.mjs`
Expected: FAIL with "Cannot find module '../src/lib/store.ts'"

- [ ] **Step 3: Write the implementation**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export type OwnedStore = { id: string; slug: string; name: string }

export async function getOwnedStore(client: SupabaseClient): Promise<OwnedStore | null> {
  const { data, error } = await client
    .from('store_staff')
    .select('stores(id,slug,name)')
    .maybeSingle()
  if (error) throw error
  return (data?.stores as unknown as OwnedStore | undefined) ?? null
}

export async function getStoreSetupCounts(client: SupabaseClient, storeId: string) {
  const [items, tables] = await Promise.all([
    client.from('menu_items').select('id').eq('store_id', storeId),
    client.from('tables').select('id').eq('store_id', storeId),
  ])
  if (items.error) throw items.error
  if (tables.error) throw tables.error
  return { menuItemCount: items.data?.length ?? 0, tableCount: tables.data?.length ?? 0 }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/store.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts tests/store.test.mjs
git commit -m "$(cat <<'EOF'
Add getOwnedStore and getStoreSetupCounts helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Make the Supabase client lazily initialized

**Files:**
- Modify: `src/lib/supabase.ts`
- Modify: `src/App.tsx` (`OrderPage`'s existing dynamic import, around line 118)

**Why this is needed now:** `src/lib/supabase.ts` currently does `export const supabase = createClient(...)` at module scope, throwing immediately if env vars are missing. `OrderPage` avoids ever paying for that by dynamically importing it only when actually loading a menu. Tasks 7-11 add several more components (`Signup`, `Onboarding`, `LoginPage`, `Dashboard`) that also need a client — if they statically imported today's module, the eager throw would fire the instant `App.tsx` loads, breaking the landing page (`/`) for anyone without `.env.local` configured. Making client creation lazy (deferred until first actual use) fixes this once, at the source, so every later task can import it normally.

- [ ] **Step 1: Rewrite `src/lib/supabase.ts`**

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) throw new Error('Add your Supabase settings to .env.local')
  client = createClient(url, publishableKey)
  return client
}
```

- [ ] **Step 2: Update `OrderPage`'s existing usage in `src/App.tsx`**

Find (around line 118, inside `OrderPage`'s `fetchMenu`):

```typescript
const { supabase } = await import('./lib/supabase')
const menu = await loadMenu(supabase, slug, tableCode, controller.signal)
```

Replace with:

```typescript
const { getSupabase } = await import('./lib/supabase')
const menu = await loadMenu(getSupabase(), slug, tableCode, controller.signal)
```

- [ ] **Step 3: Verify the customer menu still loads**

Run: `npm run dev`, open `/order/kape-ni-juan?table=T01`.
Expected: The menu loads exactly as before — this step only changes how the client is obtained, not any request behavior.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: All tests still pass (none of them import `src/lib/supabase.ts` directly — they construct their own clients — so this change shouldn't affect them, but confirm).

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.ts src/App.tsx
git commit -m "$(cat <<'EOF'
Make the Supabase client lazily initialized

Defers client creation (and its env-var check) until first actual
use, so pages that don't need Supabase — like the landing page — can
safely coexist with pages that statically import it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Extract shared `go()` navigation helper

**Files:**
- Create: `src/lib/navigate.ts`
- Modify: `src/App.tsx:38-42`

`go()` currently lives at module scope in `App.tsx`. `Signup.tsx` and `Onboarding.tsx` (Tasks 9 and 10) need the same function — pulling it into its own module avoids duplicating it in three files.

- [ ] **Step 1: Create the shared module**

```typescript
export function go(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0, behavior: 'instant' })
}
```

- [ ] **Step 2: Update `App.tsx` to import it instead of defining it locally**

Delete (around line 38-42):

```typescript
function go(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0, behavior: 'instant' })
}
```

Add to the top import block (near line 8-9):

```typescript
import { go } from './lib/navigate'
```

- [ ] **Step 3: Verify the app still builds and runs**

Run: `npm run build`
Expected: Build succeeds with no errors about `go` being undefined or duplicated.

- [ ] **Step 4: Commit**

```bash
git add src/lib/navigate.ts src/App.tsx
git commit -m "$(cat <<'EOF'
Extract go() navigation helper into a shared module

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `useSession` / `useRedirectIfSignedIn` hooks

**Files:**
- Create: `src/lib/session.ts`

No automated test here — it's a React hook wrapping `supabase.auth`, and this repo has no component/hook test renderer set up (consistent with the rest of the app's UI code, which is verified by building and exercising it in the browser, not unit tests). It's verified manually once wired into real pages in Tasks 9-11, and via `npm run build` for type-correctness now.

- [ ] **Step 1: Write the module**

```typescript
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase } from './supabase'
import { getOwnedStore, type OwnedStore } from './store'
import { go } from './navigate'

export type Session =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: User; store: OwnedStore | null }

export function useSession(): Session {
  const [session, setSession] = useState<Session>({ status: 'loading' })

  useEffect(() => {
    let current = true
    const supabase = getSupabase()

    async function resolve(user: User | null) {
      if (!user) { if (current) setSession({ status: 'signed-out' }); return }
      const store = await getOwnedStore(supabase)
      if (current) setSession({ status: 'signed-in', user, store })
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session?.user ?? null))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, authSession) => {
      void resolve(authSession?.user ?? null)
    })

    return () => {
      current = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  return session
}

export function useRedirectIfSignedIn(session: Session) {
  useEffect(() => {
    if (session.status !== 'signed-in') return
    go(session.store ? '/dashboard/orders' : '/onboarding')
  }, [session])
}
```

- [ ] **Step 2: Verify types compile**

Run: `npm run build`
Expected: Succeeds (this file isn't imported by anything yet, but `tsc -b` still type-checks it since it's under `src/`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/session.ts
git commit -m "$(cat <<'EOF'
Add useSession/useRedirectIfSignedIn hooks for Supabase Auth state

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Onboarding/signup CSS

**Files:**
- Modify: `src/styles.css` (append at end)

Writing this before the components that use it means Tasks 9/10 can be verified visually the moment they're wired up, instead of shipping unstyled markup temporarily.

- [ ] **Step 1: Append the new rules**

```css
/* onboarding */
.onboarding{min-height:100vh;background:#fbfaf6;display:flex;flex-direction:column;align-items:center;padding:50px 20px}
.onboarding-shell{width:min(560px,100%)}
.onboarding-steps{display:flex;gap:8px;margin:34px 0 24px;font-size:10px;font-weight:800;letter-spacing:.6px;color:#a3ac9f}
.onboarding-step{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:100px;background:#f1f0e8}
.onboarding-step.active{background:var(--green);color:white}
.onboarding-step.done{background:#e5edd9;color:#3c6b46}
.onboarding-card{background:white;border:1px solid #e4e2da;border-radius:18px;padding:32px}
.onboarding-card h2{font:700 24px 'Manrope';margin:0 0 6px;letter-spacing:-.8px}
.onboarding-card>p{color:#7f8983;font-size:12px;line-height:1.6;margin:0 0 24px}
.item-list{display:grid;gap:10px;margin:18px 0}
.item-row{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;background:#f8f7f2;border:1px solid #e8e6de;border-radius:10px;padding:10px 12px;font-size:12px}
.item-row span{color:#7f8983;font-size:10px}
.item-row button{border:0;background:transparent;color:#b56a51;display:grid;place-items:center;padding:4px}
.add-form{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-top:6px}
.add-form input{height:42px;border:1px solid #dddcd5;border-radius:9px;padding:0 12px;font-size:12px}
.add-form button{border:0;background:var(--green);color:white;border-radius:9px;padding:0 14px;font-weight:700;font-size:11px;display:flex;align-items:center;gap:6px;justify-content:center}
.wizard-actions{display:flex;justify-content:space-between;align-items:center;margin-top:26px}
.wizard-skip{border:0;background:transparent;color:#7f8983;font-size:11px;font-weight:700}
.wizard-continue{border:0;background:var(--green);color:white;border-radius:11px;padding:13px 22px;font-weight:700;font-size:12px;display:flex;align-items:center;gap:8px}
.wizard-continue:disabled{opacity:.6;cursor:not-allowed}
.setup-banner{display:flex;align-items:center;justify-content:space-between;gap:14px;background:#fff3e0;border:1px solid #f3d9a8;border-radius:12px;padding:14px 18px;margin:0 0 22px;font-size:12px;color:#8a5a1f}
.setup-banner button{border:0;background:#8a5a1f;color:white;border-radius:8px;padding:8px 14px;font-size:11px;font-weight:700;white-space:nowrap}
@media(max-width:600px){.add-form{grid-template-columns:1fr 1fr}.add-form button{grid-column:1/-1}}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "$(cat <<'EOF'
Add onboarding wizard and setup-banner styles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `/signup` page

**Files:**
- Create: `src/Signup.tsx`
- Modify: `src/App.tsx` (routing, in `export default function App()`)

- [ ] **Step 1: Write the component**

```tsx
import { useState } from 'react'
import { ArrowRight, ChevronLeft, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from 'lucide-react'
import { getSupabase } from './lib/supabase'
import { go } from './lib/navigate'
import { useSession, useRedirectIfSignedIn } from './lib/session'

export default function Signup() {
  const session = useSession()
  useRedirectIfSignedIn(session)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const { error: signUpError } = await getSupabase().auth.signUp({ email, password })
    setSubmitting(false)
    if (signUpError) setError(signUpError.message)
  }

  return <main className="login-page">
    <section className="login-story">
      <div className="login-logo"><button className="logo logo-light" onClick={() => go('/')}>AliTapTap</button></div>
      <div className="story-copy">
        <span className="story-label"><Sparkles size={14} /> FOR BUSINESSES</span>
        <h1>Your own<br /><em>ordering page.</em></h1>
        <p>Create your store, add a few menu items, and start taking table orders in minutes.</p>
      </div>
      <p className="story-footer">Free to try, no card required.</p>
    </section>
    <section className="login-form-side">
      <button className="login-back" onClick={() => go('/')}><ChevronLeft /> Back to AliTapTap</button>
      <form className="login-form" onSubmit={submit}>
        <p className="form-kicker">GET STARTED</p>
        <h2>Create your account</h2>
        <p className="form-intro">Set up your business email and a password. We’ll walk you through the rest.</p>
        <label>Business email<div className="field"><Mail /><input value={email} onChange={e => { setEmail(e.target.value); setError('') }} type="email" autoComplete="email" required /></div></label>
        <label>Password<div className="field"><LockKeyhole /><input value={password} onChange={e => { setPassword(e.target.value); setError('') }} type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={6} required /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
        {error && <p className="login-error">{error}</p>}
        <button className="sign-in" type="submit" disabled={submitting}>{submitting ? 'Creating your account…' : <>Create account <ArrowRight /></>}</button>
      </form>
      <p className="login-help">Already have a store? <button type="button" onClick={() => go('/login')}>Sign in</button></p>
    </section>
  </main>
}
```

- [ ] **Step 2: Wire the route into `App.tsx`**

In the `export default function App()` function, add a branch before the `/login` check:

```tsx
if (path === '/signup') return <Signup />
```

And add the import near the top of `App.tsx`:

```typescript
import Signup from './Signup'
```

(The exact final shape of `App()`'s routing is assembled across this and Tasks 10-11; see Task 11 Step 4 for the complete function.)

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `/signup`.
Expected: The signup form renders with the login page's visual style. Submitting a new email/password redirects to `/onboarding` (Task 10 will make that route real — until then it will fall through to the `Landing` page, which is expected at this point in the plan).

- [ ] **Step 4: Commit**

```bash
git add src/Signup.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
Add self-serve /signup page backed by Supabase Auth

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Onboarding wizard (`/onboarding`)

**Files:**
- Create: `src/Onboarding.tsx`
- Modify: `src/App.tsx` (routing)

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useState } from 'react'
import { ArrowRight, Check, Plus, X } from 'lucide-react'
import { getSupabase } from './lib/supabase'
import { go } from './lib/navigate'
import { slugify } from './lib/slug'
import { getStoreSetupCounts, type OwnedStore } from './lib/store'
import { useSession } from './lib/session'

type DraftItem = { id: string; name: string; price: number; category: string }
type DraftTable = { code: string; label: string }

const DEFAULT_TABLES: DraftTable[] = [
  { code: 'T01', label: 'Table 01' },
  { code: 'T02', label: 'Table 02' },
  { code: 'Counter', label: 'Counter' },
]

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const labels = ['Store', 'Menu', 'Tables'] as const
  return <div className="onboarding-steps">
    {labels.map((label, index) => {
      const n = (index + 1) as 1 | 2 | 3
      return <span key={label} className={`onboarding-step ${n === step ? 'active' : n < step ? 'done' : ''}`}>
        {n < step ? <Check size={12} /> : n} {label}
      </span>
    })}
  </div>
}

function StoreStep({ onCreated }: { onCreated: (store: OwnedStore) => void }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const { data, error: rpcError } = await getSupabase().rpc('create_store', { store_name: name, store_slug: slug })
    setSubmitting(false)
    if (rpcError) {
      setError(rpcError.code === '23505' ? 'That link is taken — try another.' : rpcError.message)
      return
    }
    onCreated(data as OwnedStore)
  }

  return <div className="onboarding-card">
    <h2>Name your store</h2>
    <p>This is what customers will see when they tap a table card.</p>
    <form className="login-form" onSubmit={submit}>
      <label>Store name<div className="field"><input value={name} onChange={e => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }} required /></div></label>
      <label>Your menu link<div className="field"><span>/order/</span><input value={slug} onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true) }} required /></div></label>
      {error && <p className="login-error">{error}</p>}
      <div className="wizard-actions"><span /><button className="wizard-continue" type="submit" disabled={submitting}>{submitting ? 'Creating…' : <>Continue <ArrowRight size={16} /></>}</button></div>
    </form>
  </div>
}

function MenuStep({ store, onDone }: { store: OwnedStore; onDone: () => void }) {
  const supabase = getSupabase()
  const [items, setItems] = useState<DraftItem[]>([])
  const [categoryIds, setCategoryIds] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')

  const addItem = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const parsedPrice = Number(price)
    if (!name.trim() || !category.trim() || !(parsedPrice >= 0)) { setError('Add a name, category, and a valid price.'); return }

    let categoryId = categoryIds[category]
    if (!categoryId) {
      const { data, error: categoryError } = await supabase.from('categories')
        .insert({ store_id: store.id, name: category.trim() }).select('id').single()
      if (categoryError) { setError(categoryError.message); return }
      categoryId = data.id
      setCategoryIds(prev => ({ ...prev, [category]: categoryId! }))
    }

    const { data, error: itemError } = await supabase.from('menu_items')
      .insert({ store_id: store.id, category_id: categoryId, name: name.trim(), price: parsedPrice })
      .select('id').single()
    if (itemError) { setError(itemError.message); return }

    setItems(prev => [...prev, { id: data.id, name: name.trim(), price: parsedPrice, category: category.trim() }])
    setName(''); setPrice(''); setCategory('')
  }

  const removeItem = async (item: DraftItem) => {
    await supabase.from('menu_items').delete().eq('id', item.id)
    setItems(prev => prev.filter(value => value.id !== item.id))
  }

  return <div className="onboarding-card">
    <h2>Add a few menu items</h2>
    <p>You can add more, edit prices, or come back to this anytime.</p>
    {items.length > 0 && <div className="item-list">{items.map(item => <div className="item-row" key={item.id}><div><b>{item.name}</b> <span>{item.category}</span></div><span>₱{item.price}</span><button onClick={() => removeItem(item)} aria-label={`Remove ${item.name}`}><X size={14} /></button></div>)}</div>}
    <form className="add-form" onSubmit={addItem}>
      <input placeholder="Item name" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} />
      <input placeholder="Price" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
      <button type="submit"><Plus size={14} /> Add</button>
    </form>
    {error && <p className="login-error">{error}</p>}
    <div className="wizard-actions">
      <button className="wizard-skip" type="button" onClick={onDone}>Skip for now</button>
      <button className="wizard-continue" type="button" onClick={onDone}>Continue <ArrowRight size={16} /></button>
    </div>
  </div>
}

function TablesStep({ store }: { store: OwnedStore }) {
  const supabase = getSupabase()
  const [tables, setTables] = useState<DraftTable[]>(DEFAULT_TABLES)
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const addTable = (event: React.FormEvent) => {
    event.preventDefault()
    if (!code.trim() || !label.trim()) return
    setTables(prev => [...prev, { code: code.trim(), label: label.trim() }])
    setCode(''); setLabel('')
  }

  const finish = async (tablesToSave: DraftTable[]) => {
    setSubmitting(true)
    setError('')
    if (tablesToSave.length > 0) {
      const { error: insertError } = await supabase.from('tables')
        .insert(tablesToSave.map(table => ({ store_id: store.id, code: table.code, label: table.label })))
      if (insertError) { setSubmitting(false); setError(insertError.message); return }
    }
    go('/dashboard/orders')
  }

  return <div className="onboarding-card">
    <h2>Add your tables</h2>
    <p>Each table gets its own link for an NFC card or QR code. You can adjust these later.</p>
    <div className="item-list">{tables.map((table, index) => <div className="item-row" key={table.code}><div><b>{table.label}</b> <span>{table.code}</span></div><span /><button onClick={() => setTables(prev => prev.filter((_, i) => i !== index))} aria-label={`Remove ${table.label}`}><X size={14} /></button></div>)}</div>
    <form className="add-form" onSubmit={addTable}>
      <input placeholder="Label (e.g. Table 04)" value={label} onChange={e => setLabel(e.target.value)} />
      <input placeholder="Code (e.g. T04)" value={code} onChange={e => setCode(e.target.value)} />
      <span />
      <button type="submit"><Plus size={14} /> Add</button>
    </form>
    {error && <p className="login-error">{error}</p>}
    <div className="wizard-actions">
      <button className="wizard-skip" type="button" disabled={submitting} onClick={() => finish([])}>Skip for now</button>
      <button className="wizard-continue" type="button" disabled={submitting} onClick={() => finish(tables)}>{submitting ? 'Saving…' : <>Finish setup <ArrowRight size={16} /></>}</button>
    </div>
  </div>
}

export default function Onboarding() {
  const session = useSession()
  const [store, setStore] = useState<OwnedStore | null>(null)
  const [step, setStep] = useState<1 | 2 | 3 | null>(null)

  useEffect(() => {
    if (session.status === 'signed-out') { go('/login'); return }
    if (session.status !== 'signed-in') return
    if (!session.store) { setStore(null); setStep(1); return }
    setStore(session.store)
    let current = true
    getStoreSetupCounts(getSupabase(), session.store.id).then(counts => {
      if (!current) return
      if (counts.menuItemCount === 0) setStep(2)
      else if (counts.tableCount === 0) setStep(3)
      else go('/dashboard/orders')
    })
    return () => { current = false }
  }, [session])

  if (step === null) return <main className="onboarding" />

  return <main className="onboarding"><div className="onboarding-shell">
    <StepIndicator step={step} />
    {step === 1 && <StoreStep onCreated={value => { setStore(value); setStep(2) }} />}
    {step === 2 && store && <MenuStep store={store} onDone={() => setStep(3)} />}
    {step === 3 && store && <TablesStep store={store} />}
  </div></main>
}
```

- [ ] **Step 2: Wire the route into `App.tsx`**

Add a branch (grouped with the `/signup` branch from Task 9):

```tsx
if (path === '/onboarding') return <Onboarding />
```

And import:

```typescript
import Onboarding from './Onboarding'
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. Sign up a fresh account at `/signup`, confirm it lands on `/onboarding` at Step 1. Create a store, confirm it advances to Step 2, add one item, click Continue, add/remove a couple of default tables in Step 3, click "Finish setup". Confirm it redirects to `/dashboard/orders` (Task 11 will make this route show real data — for now it will fall through to `Landing`, which is expected until Task 11 is done). Separately, test "Skip for now" on both Step 2 and Step 3 to confirm it doesn't block progress. Reload mid-wizard (after Step 1, before finishing Step 3) and confirm navigating back to `/onboarding` resumes at the right step instead of restarting.

- [ ] **Step 4: Commit**

```bash
git add src/Onboarding.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
Add guided onboarding wizard for store setup

Store creation, menu items, and tables are each skippable except the
store name/slug step, and resuming /onboarding picks up wherever the
store's setup left off.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Real auth for `/login`, store-aware Dashboard, and final `App()` routing

**Files:**
- Modify: `src/App.tsx` (removes `DEMO_EMAIL`/`DEMO_PASSWORD`/`SESSION_KEY`/`hasStaffSession`, reworks `LoginPage` and `Dashboard`, rewrites `App()`)

This is the task that removes the old fake-session code entirely and finishes wiring `/login` and `/dashboard*` to real Supabase Auth and real store data.

- [ ] **Step 1: Remove the fake-session constants and helper**

Delete (currently around line 25-27):

```typescript
const DEMO_EMAIL = 'staff@kapenijuan.ph'
const DEMO_PASSWORD = 'tapcard123'
const SESSION_KEY = 'tapcard_staff_session'
```

Delete (currently around line 44-46):

```typescript
function hasStaffSession() {
  return localStorage.getItem(SESSION_KEY) === 'active'
}
```

Add back just the two plain string constants, for the demo-credentials hint box shown on the login form (no longer used for any auth check — just display text):

```typescript
const DEMO_EMAIL = 'staff@kapenijuan.ph'
const DEMO_PASSWORD = 'tapcard123'
```

- [ ] **Step 2: Replace `LoginPage` (currently lines 48-97)**

```tsx
function LoginPage() {
  const session = useSession()
  useRedirectIfSignedIn(session)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const { error: signInError } = await getSupabase().auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (signInError) setError('That email or password doesn’t match an account.')
  }

  return <main className="login-page">
    <section className="login-story">
      <div className="login-logo"><Logo light /></div>
      <div className="story-copy">
        <span className="story-label"><Sparkles size={14} /> STAFF WORKSPACE</span>
        <h1>Every order,<br /><em>right on cue.</em></h1>
        <p>Stay in sync from the first tap to the final serve. Simple, clear, and ready for the rush.</p>
      </div>
      <p className="story-footer">TapCard for small food businesses</p>
    </section>
    <section className="login-form-side">
      <button className="login-back" onClick={() => go('/')}><ChevronLeft /> Back to TapCard</button>
      <form className="login-form" onSubmit={submit}>
        <div className="mobile-login-logo"><Logo /></div>
        <p className="form-kicker">WELCOME BACK</p>
        <h2>Sign in to your workspace</h2>
        <p className="form-intro">Manage orders, update your menu, and keep service moving.</p>
        <label>Email address<div className="field"><Mail /><input value={email} onChange={e => { setEmail(e.target.value); setError('') }} type="email" autoComplete="email" required /></div></label>
        <label>Password<div className="field"><LockKeyhole /><input value={password} onChange={e => { setPassword(e.target.value); setError('') }} type={showPassword ? 'text' : 'password'} autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
        {error && <p className="login-error">{error}</p>}
        <button className="sign-in" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : <>Sign in <ArrowRight /></>}</button>
        <div className="demo-access"><span><LockKeyhole /></span><div><b>Demo staff access</b><p>Email: {DEMO_EMAIL}<br />Password: {DEMO_PASSWORD}</p></div></div>
      </form>
      <p className="login-help">Don’t have a store yet? <button type="button" onClick={() => go('/signup')}>Sign up</button></p>
    </section>
  </main>
}
```

This drops the old inert "Forgot password?" and "Contact support" placeholder buttons — they never did anything, and keeping dead buttons around would be misleading now that the rest of the form is functional.

- [ ] **Step 3: Replace `Dashboard` (currently lines 187-199) and add `SetupBanner` and `DashboardGate`**

```tsx
function SetupBanner({ menuItemCount, tableCount }: { menuItemCount: number; tableCount: number }) {
  if (menuItemCount > 0 && tableCount > 0) return null
  const missing = menuItemCount === 0 && tableCount === 0 ? 'menu items or tables' : menuItemCount === 0 ? 'menu items' : 'tables'
  return <div className="setup-banner">
    <span>Your store has no {missing} yet — finish setting up to start taking orders.</span>
    <button onClick={() => go('/onboarding')}>Finish setup</button>
  </div>
}

function Dashboard({ store, onLogout }: { store: OwnedStore; onLogout: () => void }) {
  const [counts, setCounts] = useState<{ menuItemCount: number; tableCount: number } | null>(null)
  const statuses = ['New', 'Preparing', 'Ready', 'Completed'] as const
  const initials = store.name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('')

  useEffect(() => {
    let current = true
    getStoreSetupCounts(getSupabase(), store.id).then(value => { if (current) setCounts(value) })
    return () => { current = false }
  }, [store.id])

  return <main className="dashboard">
    <aside className="sidebar"><Logo light compact /><nav><button><LayoutDashboard />Overview</button><button className="active"><ShoppingBag />Orders</button><button><UtensilsCrossed />Menu</button><button><Table2 />Tables</button><button><BarChart3 />Reports</button></nav><div className="side-profile"><div>{initials}</div><span><b>{store.name}</b><small>Owner account</small></span><button className="logout-button" title="Sign out" onClick={() => { void getSupabase().auth.signOut(); onLogout(); go('/login') }}><LogOut /></button></div></aside>
    <section className="dash-main">
      <header><div><h1>{store.name}</h1></div><div className="dash-actions"><button><Bell /></button><button><CircleUserRound /> {initials} <ChevronRight /></button></div></header>
      {counts && <SetupBanner menuItemCount={counts.menuItemCount} tableCount={counts.tableCount} />}
      <div className="stats">
        <article><span className="stat-icon peach"><ShoppingBag /></span><div><small>TODAY’S ORDERS</small><b>0</b><em>No orders yet</em></div></article>
        <article><span className="stat-icon mint"><WalletCards /></span><div><small>TODAY’S SALES</small><b>{peso(0)}</b><em>No orders yet</em></div></article>
        <article><span className="stat-icon butter"><Zap /></span><div><small>NEW ORDERS</small><b>0</b><em>Needs your attention</em></div></article>
      </div>
      <div className="board-head"><div><h2>Live orders</h2><span><i /> Live updates</span></div><p>Orders will appear here in real time once customers start ordering.</p></div>
      <div className="order-board">{statuses.map(status => <section className="order-column" key={status}><header><span className={`status-dot ${status.toLowerCase()}`} />{status}<b>0</b></header><div className="column-body"><div className="empty-column">No orders yet</div></div></section>)}</div>
    </section>
  </main>
}

function DashboardGate() {
  const session = useSession()
  useEffect(() => {
    if (session.status === 'signed-out') go('/login')
    else if (session.status === 'signed-in' && !session.store) go('/onboarding')
  }, [session])
  if (session.status !== 'signed-in' || !session.store) return <main className="dashboard" />
  return <Dashboard store={session.store} onLogout={() => go('/login')} />
}
```

This removes the old `initialOrders` fake array, the `advance()` status-progression handler, and the `DemoOrder`/`OrderStatus` types entirely — the interactive fake board is gone because it showed identical made-up numbers to every merchant regardless of their actual store, which is wrong now that stores are real and distinct. Real per-store order data is future work (order creation, out of scope for this plan per the spec).

- [ ] **Step 4: Rewrite `App()` (currently lines 201-213) with final routing**

```tsx
export default function App() {
  const [, render] = useState(0)
  useEffect(() => {
    const onPopState = () => render(value => value + 1)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  const path = location.pathname
  if (path.startsWith('/order/')) return <OrderPage key={path + location.search} />
  if (path === '/signup') return <Signup />
  if (path === '/onboarding') return <Onboarding />
  if (path === '/login') return <LoginPage />
  if (path.startsWith('/dashboard')) return <DashboardGate />
  return <Landing onNavigate={go} />
}
```

- [ ] **Step 5: Update imports at the top of `App.tsx`**

Remove `Check` and `Clock3` from the `lucide-react` import if they're no longer referenced anywhere in the file (both were only used by code this task deletes: `Check` in the old `LoginPage` story-order block, `Clock3` in the old fake order cards). Confirm before removing:

Run: `grep -n 'Check\b\|Clock3' src/App.tsx`
Expected: The only remaining matches (if any) should be the `lucide-react` import line itself — remove whichever of `Check`/`Clock3` has no other usage from that import list.

Add the new imports needed by this task:

```typescript
import { getSupabase } from './lib/supabase'
import { useSession, useRedirectIfSignedIn } from './lib/session'
import { getStoreSetupCounts, type OwnedStore } from './lib/store'
```

- [ ] **Step 6: Full manual smoke test**

Run: `npm run dev`. Walk through:
1. `/login` with a nonexistent account → shows the "doesn't match an account" error, no crash.
2. `/signup` → create an account → lands on `/onboarding` → complete all three steps → lands on `/dashboard/orders` showing the real store name in the sidebar/header, zero stats, and no `SetupBanner` (since both menu items and tables exist).
3. Sign out via the sidebar logout button → redirected to `/login`.
4. Sign back in with the same credentials at `/login` → lands directly on `/dashboard/orders` (no onboarding replay, since the store is already fully set up).
5. Visiting `/dashboard/orders` directly while signed out → redirected to `/login`.
6. Visit `/` with dev tools open → confirm no console error about missing Supabase env vars fires just from loading the landing page (this is the regression Task 5 prevents).

- [ ] **Step 7: Run the full test suite and build**

Run: `npm test && npm run build`
Expected: All tests pass; build succeeds with no unused-import or type errors.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
Wire /login and the dashboard to real Supabase Auth and store data

Removes the localStorage fake session and hardcoded demo dashboard
data in favor of session/store state resolved from Supabase, plus a
setup-completion banner and route guards for /dashboard* and /login.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Convert the Kape ni Juan demo into a real account

**Files:**
- Create: `scripts/seed-demo-account.mjs`
- Modify: `package.json` (add script entry)

- [ ] **Step 1: Write the script**

```javascript
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'

const env = loadEnv('development', process.cwd(), '')
const url = env.VITE_SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('Add VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local. Get the service_role key from Project Settings → API — never commit it or expose it to the browser.')
  process.exit(1)
}

const EMAIL = 'staff@kapenijuan.ph'
const PASSWORD = 'tapcard123'

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: store, error: storeError } = await admin.from('stores').select('id').eq('slug', 'kape-ni-juan').single()
if (storeError) {
  console.error('Could not find the kape-ni-juan store. Run the migration and supabase/seed.sql first.')
  process.exit(1)
}

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email: EMAIL, password: PASSWORD, email_confirm: true,
})
if (createError && !/already registered/i.test(createError.message)) {
  console.error(`Could not create the demo account: ${createError.message}`)
  process.exit(1)
}

let userId = created?.user?.id
if (!userId) {
  const { data: list, error: listError } = await admin.auth.admin.listUsers()
  if (listError) { console.error(listError.message); process.exit(1) }
  userId = list.users.find(user => user.email === EMAIL)?.id
}
if (!userId) {
  console.error('Could not resolve the demo account id.')
  process.exit(1)
}

const { error: linkError } = await admin.from('store_staff')
  .upsert({ store_id: store.id, user_id: userId, role: 'owner' }, { onConflict: 'store_id,user_id' })
if (linkError) {
  console.error(`Could not link the demo account to the store: ${linkError.message}`)
  process.exit(1)
}

console.log(`Demo account ready: ${EMAIL} / ${PASSWORD} → owner of Kape ni Juan.`)
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to `"scripts"` (alongside the existing `"check:supabase"` entry):

```json
"seed:demo-account": "node scripts/seed-demo-account.mjs"
```

- [ ] **Step 3: Manual verification**

Run: `npm run seed:demo-account` against your development Supabase project (after adding `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` — see Task 13).
Expected: Prints `Demo account ready: staff@kapenijuan.ph / tapcard123 → owner of Kape ni Juan.` Then sign in at `/login` with those credentials and confirm it lands on `/dashboard/orders` showing "Kape ni Juan" with its existing menu items/tables (no `SetupBanner`, since the seeded store already has both).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-demo-account.mjs package.json
git commit -m "$(cat <<'EOF'
Add script to convert the Kape ni Juan demo into a real account

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Environment and documentation updates

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Update `.env.example`**

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY

# Server-only — never prefix with VITE_, or it would ship to the browser.
# Used only by scripts/seed-demo-account.mjs. Get it from Project Settings → API.
SUPABASE_SERVICE_ROLE_KEY=sb_secret_YOUR_KEY
```

- [ ] **Step 2: Update `README.md`**

Replace the "Supabase menu setup" section through the end of the file with:

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "$(cat <<'EOF'
Document self-serve signup, the new migration, and demo account seeding

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Final full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: All test files pass — `menu-schema`, `menu-loader`, `store-accounts`, `slug`, `store`.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: Succeeds with no TypeScript errors (in particular: no unused imports left over from the `LoginPage`/`Dashboard` rewrite in Task 11).

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 4: Repeat the manual smoke test from Task 11 Step 6 end-to-end once more**, this time including the demo-account conversion from Task 12 (sign in as `staff@kapenijuan.ph` and confirm the real Kape ni Juan menu/tables show up with no setup banner).

- [ ] **Step 5: No commit for this task** — it's verification-only. If any step fails, fix the issue in the relevant earlier task's files and commit the fix there (don't accumulate an unrelated "fix build" commit at the end).
