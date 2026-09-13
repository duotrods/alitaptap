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
