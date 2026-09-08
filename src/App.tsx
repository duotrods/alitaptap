import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, BarChart3, Bell, Check, ChevronLeft, ChevronRight,
  CircleUserRound, Clock3, Eye, EyeOff, LayoutDashboard, LockKeyhole,
  LogOut, Mail, Minus, Plus, Search, ShoppingBag, Sparkles,
  Table2, UtensilsCrossed, WalletCards, X, Zap,
} from 'lucide-react'
import { menuItems, peso, type MenuItem } from './data'
import logoColor from './assets/logocolor.svg'
import logoWhite from './assets/logowhite.svg'
import Landing from './Landing'

type Cart = Record<number, number>
type OrderStatus = 'New' | 'Preparing' | 'Ready' | 'Completed'
type DemoOrder = { code: string; table: string; items: string; total: number; age: string; status: OrderStatus }

const initialOrders: DemoOrder[] = [
  { code: 'KJ-1048', table: 'Table 04', items: '2× Spanish Latte, 1× Ube Ensaymada', total: 385, age: '2 min', status: 'New' },
  { code: 'KJ-1047', table: 'Table 01', items: '1× Tablea Mocha, 1× Tuna Pandesal', total: 275, age: '6 min', status: 'Preparing' },
  { code: 'KJ-1046', table: 'Counter', items: '2× Mango Iced Tea', total: 250, age: '11 min', status: 'Ready' },
  { code: 'KJ-1045', table: 'Table 02', items: '1× Sea Salt Latte, 1× Banana Loaf', total: 240, age: '18 min', status: 'Completed' },
]

const DEMO_EMAIL = 'staff@kapenijuan.ph'
const DEMO_PASSWORD = 'tapcard123'
const SESSION_KEY = 'tapcard_staff_session'

function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return <button className={`logo ${light ? 'logo-light' : ''} ${compact ? 'logo-compact' : ''}`} onClick={() => go('/')} aria-label="AliTapTap home">
    <span className="brand-mark">
      <img className="brand-logo" src={light ? logoWhite : logoColor} alt="" />
    </span>
    <span className="brand-name">AliTapTap</span>
  </button>
}

function go(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0, behavior: 'instant' })
}

function hasStaffSession() {
  return localStorage.getItem(SESSION_KEY) === 'active'
}

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState(DEMO_EMAIL)
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      setError('That email or password doesn’t match the demo account.')
      return
    }
    localStorage.setItem(SESSION_KEY, 'active')
    onLogin()
    go('/dashboard/orders')
  }

  return <main className="login-page">
    <section className="login-story">
      <div className="login-logo"><Logo light /></div>
      <div className="story-copy">
        <span className="story-label"><Sparkles size={14} /> STAFF WORKSPACE</span>
        <h1>Every order,<br /><em>right on cue.</em></h1>
        <p>Stay in sync from the first tap to the final serve. Simple, clear, and ready for the rush.</p>
        <div className="story-order">
          <span className="story-check"><Check /></span>
          <div><small>ORDER KJ-1048</small><b>New order from Table 04</b><p>2× Spanish Latte · 1× Ube Ensaymada</p></div>
          <span>Just now</span>
        </div>
      </div>
      <p className="story-footer">TapCard for Kape ni Juan</p>
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
        <div className="form-options"><label><input type="checkbox" defaultChecked /> Keep me signed in</label><button type="button">Forgot password?</button></div>
        {error && <p className="login-error">{error}</p>}
        <button className="sign-in" type="submit">Sign in <ArrowRight /></button>
        <div className="demo-access"><span><LockKeyhole /></span><div><b>Demo staff access</b><p>Email: {DEMO_EMAIL}<br />Password: {DEMO_PASSWORD}</p></div></div>
      </form>
      <p className="login-help">Need help? <button type="button">Contact support</button></p>
    </section>
  </main>
}

function OrderPage() {
  const [category, setCategory] = useState('All')
  const [cart, setCart] = useState<Cart>({})
  const [cartOpen, setCartOpen] = useState(false)
  const categories = ['All', 'Coffee', 'Refreshers', 'Bakes']
  const list = category === 'All' ? menuItems : menuItems.filter(i => i.category === category)
  const count = Object.values(cart).reduce((a, b) => a + b, 0)
  const total = menuItems.reduce((sum, item) => sum + item.price * (cart[item.id] || 0), 0)
  const update = (id: number, delta: number) => setCart(old => ({ ...old, [id]: Math.max(0, (old[id] || 0) + delta) }))
  const table = new URLSearchParams(location.search).get('table') || 'T01'

  return <main className="order-page">
    <header className="order-header"><div className="order-shell"><button className="back" onClick={() => go('/')}><ChevronLeft /> Back</button><Logo /><button className="cart-button" onClick={() => setCartOpen(true)}><ShoppingBag size={19} />{count > 0 && <span>{count}</span>}</button></div></header>
    <section className="store-hero"><div className="order-shell"><div className="store-monogram">KJ</div><div><p className="open-now"><i /> OPEN NOW · UNTIL 9 PM</p><h1>Kape ni Juan</h1><p>Local coffee, familiar comfort.</p></div><div className="table-chip"><Table2 size={17} /><span>Ordering for<small>{table.replace('T', 'Table ')}</small></span></div></div></section>
    <section className="menu-section order-shell"><div className="menu-intro"><div><h2>What are you craving?</h2><p>Freshly made, just for you.</p></div><button className="search"><Search size={19} /></button></div>
      <div className="categories">{categories.map(c => <button className={category === c ? 'active' : ''} onClick={() => setCategory(c)} key={c}>{c}</button>)}</div>
      <div className="menu-grid">{list.map(item => <MenuCard key={item.id} item={item} quantity={cart[item.id] || 0} update={update} />)}</div>
    </section>
    {count > 0 && <button className="floating-cart" onClick={() => setCartOpen(true)}><span><ShoppingBag size={18} /> {count} {count === 1 ? 'item' : 'items'}</span><b>View order · {peso(total)}</b></button>}
    {cartOpen && <CartPanel cart={cart} update={update} total={total} close={() => setCartOpen(false)} />}
  </main>
}

function MenuCard({ item, quantity, update }: { item: MenuItem; quantity: number; update: (id: number, delta: number) => void }) {
  return <article className="menu-card"><div className="food-art" style={{ background: item.color }}><span>{item.emoji}</span>{item.popular && <b>POPULAR</b>}</div><div className="food-copy"><small>{item.category}</small><h3>{item.name}</h3><p>{item.description}</p><div><strong>{peso(item.price)}</strong>{quantity === 0 ? <button onClick={() => update(item.id, 1)} aria-label={`Add ${item.name}`}><Plus /></button> : <div className="quantity"><button onClick={() => update(item.id, -1)}><Minus /></button><b>{quantity}</b><button onClick={() => update(item.id, 1)}><Plus /></button></div>}</div></div></article>
}

function CartPanel({ cart, update, total, close }: { cart: Cart; update: (id: number, delta: number) => void; total: number; close: () => void }) {
  const selected = menuItems.filter(i => cart[i.id] > 0)
  const [placed, setPlaced] = useState(false)
  return <div className="overlay" onMouseDown={e => e.target === e.currentTarget && close()}><aside className="cart-panel">{placed ? <div className="order-success"><div><Check /></div><p>ORDER CONFIRMED</p><h2>You’re all set!</h2><span>We’ve sent order <b>KJ-1049</b> to the kitchen.</span><button onClick={close}>Done</button></div> : <><div className="panel-head"><div><small>TABLE 01</small><h2>Your order</h2></div><button onClick={close}><X /></button></div><div className="cart-lines">{selected.map(item => <div className="cart-line" key={item.id}><div className="line-art" style={{ background: item.color }}>{item.emoji}</div><div><b>{item.name}</b><span>{peso(item.price)}</span></div><div className="quantity"><button onClick={() => update(item.id, -1)}><Minus /></button><b>{cart[item.id]}</b><button onClick={() => update(item.id, 1)}><Plus /></button></div></div>)}</div><label className="note-label">Add a note for the kitchen<textarea placeholder="e.g. Less ice, no sugar..." /></label><div className="cart-total"><span>Subtotal</span><b>{peso(total)}</b><small>Payment is made at the counter.</small></div><button className="place-order" disabled={!selected.length} onClick={() => setPlaced(true)}>Place order <ArrowRight /></button></>}</aside></div>
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [orders, setOrders] = useState(initialOrders)
  const statuses: OrderStatus[] = ['New', 'Preparing', 'Ready', 'Completed']
  const advance = (code: string) => setOrders(old => old.map(o => { const n = statuses.indexOf(o.status); return o.code === code && n < 3 ? { ...o, status: statuses[n + 1] } : o }))
  const counts = useMemo(() => Object.fromEntries(statuses.map(s => [s, orders.filter(o => o.status === s).length])), [orders])
  return <main className="dashboard"><aside className="sidebar"><Logo light compact /><nav><button><LayoutDashboard />Overview</button><button className="active"><ShoppingBag />Orders<span>{counts.New}</span></button><button><UtensilsCrossed />Menu</button><button><Table2 />Tables</button><button><BarChart3 />Reports</button></nav><div className="side-profile"><div>KJ</div><span><b>Kape ni Juan</b><small>Admin account</small></span><button className="logout-button" title="Sign out" onClick={() => { localStorage.removeItem(SESSION_KEY); onLogout(); go('/login') }}><LogOut /></button></div></aside>
    <section className="dash-main"><header><div><p>FRIDAY, SEPTEMBER 4</p><h1>Good afternoon, Juan.</h1></div><div className="dash-actions"><button><Bell /><i /></button><button><CircleUserRound /> Juan <ChevronRight /></button></div></header>
      <div className="stats"><article><span className="stat-icon peach"><ShoppingBag /></span><div><small>TODAY’S ORDERS</small><b>24</b><em>↑ 12% from yesterday</em></div></article><article><span className="stat-icon mint"><WalletCards /></span><div><small>TODAY’S SALES</small><b>₱3,840</b><em>↑ 8% from yesterday</em></div></article><article><span className="stat-icon butter"><Zap /></span><div><small>NEW ORDERS</small><b>{counts.New}</b><em>Needs your attention</em></div></article></div>
      <div className="board-head"><div><h2>Live orders</h2><span><i /> Live updates</span></div><p>Drag or use the action button to move orders along.</p></div>
      <div className="order-board">{statuses.map(status => <section className="order-column" key={status}><header><span className={`status-dot ${status.toLowerCase()}`} />{status}<b>{counts[status]}</b></header><div className="column-body">{orders.filter(o => o.status === status).map(o => <article className="order-card" key={o.code}><div className="order-meta"><b>{o.code}</b><span><Clock3 /> {o.age}</span></div><h3>{o.table}</h3><p>{o.items}</p><div className="order-total"><b>{peso(o.total)}</b>{status !== 'Completed' && <button onClick={() => advance(o.code)}>{status === 'New' ? 'Start preparing' : status === 'Preparing' ? 'Mark ready' : 'Complete'} <ChevronRight /></button>}</div></article>)}{!orders.some(o => o.status === status) && <div className="empty-column">No orders here</div>}</div></section>)}</div>
    </section>
  </main>
}

export default function App() {
  const [, render] = useState(0)
  const [authenticated, setAuthenticated] = useState(hasStaffSession)
  useEffect(() => {
    const onPopState = () => render(value => value + 1)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  if (location.pathname.startsWith('/order/')) return <OrderPage />
  if (location.pathname === '/login') return authenticated ? <Dashboard onLogout={() => setAuthenticated(false)} /> : <LoginPage onLogin={() => setAuthenticated(true)} />
  if (location.pathname.startsWith('/dashboard')) return authenticated ? <Dashboard onLogout={() => setAuthenticated(false)} /> : <LoginPage onLogin={() => setAuthenticated(true)} />
  return <Landing onNavigate={go} />
}
