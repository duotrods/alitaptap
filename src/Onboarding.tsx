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
