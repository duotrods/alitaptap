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
