import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import { loadMenu } from '../src/lib/menu.ts'

const env = loadEnv('development', process.cwd(), '')
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.error('Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.')
  process.exit(1)
}

try {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const menu = await loadMenu(
    client, process.argv[2] ?? 'kape-ni-juan', process.argv[3] ?? 'T01', AbortSignal.timeout(15000),
  )
  console.log(`Connected: ${menu.store.name} — ${menu.table.label}.`)
  console.log(`${menu.categories.length} categories and ${menu.items.length} available menu items.`)
} catch (error) {
  // Never print connection URLs, keys, or raw request details.
  const code = typeof error?.code === 'string' ? error.code : null
  if (code === 'PGRST205') {
    console.error('Supabase is reachable. Run the menu migration and seed in the SQL Editor (see README.md).')
  } else if (code === '42501') {
    console.error('Menu access was denied. Check that the complete migration, including grants and policies, was applied.')
  } else if (error?.kind === 'store' || error?.kind === 'table') {
    console.error('The demo store or table is missing or inactive. Run supabase/seed.sql and check the records.')
  } else {
    console.error('Could not read the menu. Check your connection, project URL, publishable key, and Data API settings.')
  }
  process.exitCode = 1
}
