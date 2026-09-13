import { useEffect, useState } from 'react'
import {
  ArrowRight, BarChart3, Bell, ChevronLeft, ChevronRight,
  CircleUserRound, Eye, EyeOff, LayoutDashboard, LockKeyhole,
  LogOut, Mail, Minus, Plus, ShoppingBag, Sparkles,
  Table2, UtensilsCrossed, WalletCards, X, Zap,
} from 'lucide-react'
import { peso } from './data'
import { loadMenu, MenuError, type MenuItem, type StoreMenu } from './lib/menu'
import { go } from './lib/navigate'
import { getSupabase } from './lib/supabase'
import { useSession, useRedirectIfSignedIn } from './lib/session'
import { getStoreSetupCounts, type OwnedStore } from './lib/store'
import logoColor from './assets/logocolor.svg'
import logoWhite from './assets/logowhite.svg'
import Landing from './Landing'
import Signup from './Signup'
import Onboarding from './Onboarding'

type Cart = Record<string, number>

const DEMO_EMAIL = 'staff@kapenijuan.ph'
const DEMO_PASSWORD = 'tapcard123'

function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return <button className={`logo ${light ? 'logo-light' : ''} ${compact ? 'logo-compact' : ''}`} onClick={() => go('/')} aria-label="AliTapTap home">
    <span className="brand-mark">
      <img className="brand-logo" src={light ? logoWhite : logoColor} alt="" />
    </span>
    <span className="brand-name">AliTapTap</span>
  </button>
}

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

function OrderPage() {
  const [category, setCategory] = useState('')
  const [cart, setCart] = useState<Cart>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ready'; menu: StoreMenu } | { status: 'error'; error: MenuError }
  >({ status: 'loading' })
  const slug = location.pathname.slice('/order/'.length)
  const tableCode = new URLSearchParams(location.search).get('table')

  useEffect(() => {
    let current = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    setState({ status: 'loading' })

    async function fetchMenu() {
      try {
        const { getSupabase } = await import('./lib/supabase')
        const menu = await loadMenu(getSupabase(), slug, tableCode, controller.signal)
        if (current) setState({ status: 'ready', menu })
      } catch (error) {
        if (current) setState({
          status: 'error',
          error: error instanceof MenuError ? error : new MenuError(
            'connection', 'We couldn’t load the menu. Please try again or ask a staff member for help.',
          ),
        })
      } finally {
        window.clearTimeout(timeout)
      }
    }

    void fetchMenu()
    return () => {
      current = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [slug, tableCode, attempt])

  const menu = state.status === 'ready' ? state.menu : null
  const items = menu?.items ?? []
  const list = category ? items.filter(item => item.category_id === category) : items
  const count = Object.values(cart).reduce((a, b) => a + b, 0)
  const total = items.reduce((sum, item) => sum + Math.round(item.price * 100) * (cart[item.id] || 0), 0) / 100
  const update = (id: string, delta: number) => setCart(old => ({ ...old, [id]: Math.max(0, Math.min(99, (old[id] || 0) + delta)) }))
  const initials = menu?.store.name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('')

  return <main className="order-page">
    <header className="order-header"><div className="order-shell"><button className="back" onClick={() => go('/')}><ChevronLeft /> Back</button><Logo /><button className="cart-button" disabled={!menu} onClick={() => setCartOpen(true)} aria-label="Open cart"><ShoppingBag size={19} />{count > 0 && <span>{count}</span>}</button></div></header>
    {state.status === 'loading' && <section className="menu-message order-shell" role="status"><h1>Loading the menu…</h1><p>Finding something good for your table.</p></section>}
    {state.status === 'error' && <section className="menu-message order-shell" role="alert">
      <h1>{state.error.kind === 'table' ? 'Check your table link' : state.error.kind === 'store' ? 'Menu unavailable' : 'Unable to load the menu'}</h1>
      <p>{state.error.message}</p>
      <button onClick={() => setAttempt(value => value + 1)}>Try again</button>
    </section>}
    {menu && <>
      <section className="store-hero"><div className="order-shell"><div className="store-monogram">{initials}</div><div><p className="open-now">OUR MENU</p><h1>{menu.store.name}</h1><p>{menu.store.description}</p></div><div className="table-chip"><Table2 size={17} /><span>Ordering for<small>{menu.table.label}</small></span></div></div></section>
      <section className="menu-section order-shell"><div className="menu-intro"><div><h2>What are you craving?</h2><p>Freshly made, just for you.</p></div></div>
        <div className="categories" aria-label="Menu categories">
          <button className={!category ? 'active' : ''} aria-pressed={!category} onClick={() => setCategory('')}>All</button>
          {menu.categories.map(item => <button className={category === item.id ? 'active' : ''} aria-pressed={category === item.id} onClick={() => setCategory(item.id)} key={item.id}>{item.name}</button>)}
        </div>
        <div className="menu-grid">{list.map(item => <MenuCard key={item.id} item={item} category={menu.categories.find(value => value.id === item.category_id)?.name ?? 'Menu'} quantity={cart[item.id] || 0} update={update} />)}</div>
        {!list.length && <div className="menu-message" role="status"><h2>No items available right now</h2><p>{category ? 'Try another category.' : 'Please check with a staff member.'}</p></div>}
      </section>
      {count > 0 && <button className="floating-cart" onClick={() => setCartOpen(true)}><span><ShoppingBag size={18} /> {count} {count === 1 ? 'item' : 'items'}</span><b>View order · {peso(total)}</b></button>}
      {cartOpen && <CartPanel items={items} tableLabel={menu.table.label} cart={cart} update={update} total={total} close={() => setCartOpen(false)} />}
    </>}
  </main>
}

function MenuCard({ item, category, quantity, update }: { item: MenuItem; category: string; quantity: number; update: (id: string, delta: number) => void }) {
  return <article className="menu-card"><div className="food-art" style={{ background: item.color }}><span>{item.emoji}</span>{item.popular && <b>POPULAR</b>}</div><div className="food-copy"><small>{category}</small><h3>{item.name}</h3><p>{item.description}</p><div><strong>{peso(item.price)}</strong>{quantity === 0 ? <button onClick={() => update(item.id, 1)} aria-label={`Add ${item.name}`}><Plus /></button> : <div className="quantity"><button onClick={() => update(item.id, -1)} aria-label={`Remove one ${item.name}`}><Minus /></button><b>{quantity}</b><button onClick={() => update(item.id, 1)} disabled={quantity >= 99} aria-label={`Add one ${item.name}`}><Plus /></button></div>}</div></div></article>
}

function CartPanel({ items, tableLabel, cart, update, total, close }: { items: MenuItem[]; tableLabel: string; cart: Cart; update: (id: string, delta: number) => void; total: number; close: () => void }) {
  const selected = items.filter(item => cart[item.id] > 0)
  return <div className="overlay" onMouseDown={e => e.target === e.currentTarget && close()}><aside className="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
    <div className="panel-head"><div><small>{tableLabel}</small><h2 id="cart-title">Your order</h2></div><button onClick={close} aria-label="Close cart"><X /></button></div>
    <div className="cart-lines">{selected.map(item => <div className="cart-line" key={item.id}><div className="line-art" style={{ background: item.color }}>{item.emoji}</div><div><b>{item.name}</b><span>{peso(item.price)}</span></div><div className="quantity"><button onClick={() => update(item.id, -1)} aria-label={`Remove one ${item.name}`}><Minus /></button><b>{cart[item.id]}</b><button onClick={() => update(item.id, 1)} disabled={cart[item.id] >= 99} aria-label={`Add one ${item.name}`}><Plus /></button></div></div>)}{!selected.length && <p>Your cart is empty. Add something from the menu.</p>}</div>
    <div className="cart-total"><span>Subtotal</span><b>{peso(total)}</b><small>Online ordering is coming soon. Please place your order with a staff member.</small></div>
    <button className="place-order" onClick={close}>Continue browsing <ArrowRight /></button>
  </aside></div>
}

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
    <aside className="sidebar"><Logo light compact /><nav><button><LayoutDashboard />Overview</button><button className="active"><ShoppingBag />Orders</button><button><UtensilsCrossed />Menu</button><button><Table2 />Tables</button><button><BarChart3 />Reports</button></nav><div className="side-profile"><div>{initials}</div><span><b>{store.name}</b><small>Owner account</small></span><button className="logout-button" title="Sign out" onClick={async () => { await getSupabase().auth.signOut(); onLogout() }}><LogOut /></button></div></aside>
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
