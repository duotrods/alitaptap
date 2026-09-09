import type { SupabaseClient } from '@supabase/supabase-js'

export type Store = { id: string; slug: string; name: string; description: string }
export type StoreTable = { id: string; code: string; label: string }
export type Category = { id: string; name: string }
export type MenuItem = {
  id: string
  category_id: string | null
  name: string
  description: string
  price: number
  color: string
  emoji: string
  popular: boolean
}
export type StoreMenu = {
  store: Store
  table: StoreTable
  categories: Category[]
  items: MenuItem[]
}

export class MenuError extends Error {
  kind: 'store' | 'table' | 'connection'

  constructor(kind: MenuError['kind'], message: string) {
    super(message)
    this.kind = kind
  }
}

// Injection lets the loader be exercised against a test API without real credentials.
export async function loadMenu(
  client: SupabaseClient,
  slug: string,
  tableCode: string | null,
  signal: AbortSignal,
): Promise<StoreMenu> {
  if (!tableCode?.trim()) {
    throw new MenuError('table', 'Open the link on your table’s card to choose the correct table.')
  }

  const storeResult = await client.from('stores')
    .select('id,slug,name,description').eq('slug', slug).eq('active', true)
    .abortSignal(signal).maybeSingle()
  if (storeResult.error) throw storeResult.error
  if (!storeResult.data) throw new MenuError('store', 'This menu is not available. Please check the link or ask a staff member.')
  const store: Store = storeResult.data

  const tableResult = await client.from('tables')
    .select('id,code,label').eq('store_id', store.id).eq('code', tableCode).eq('active', true)
    .abortSignal(signal).maybeSingle()
  if (tableResult.error) throw tableResult.error
  if (!tableResult.data) throw new MenuError('table', 'This table link is not active. Please use the card on your table or ask a staff member.')

  const [categories, items] = await Promise.all([
    client.from('categories').select('id,name').eq('store_id', store.id)
      .order('sort_order').order('id').abortSignal(signal),
    client.from('menu_items').select('id,category_id,name,description,price,color,emoji,popular')
      .eq('store_id', store.id).eq('available', true)
      .order('sort_order').order('id').abortSignal(signal),
  ])
  if (categories.error) throw categories.error
  if (items.error) throw items.error

  return {
    store,
    table: tableResult.data,
    categories: categories.data ?? [],
    items: (items.data ?? []).map(item => ({ ...item, price: Number(item.price) })),
  }
}
