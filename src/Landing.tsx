import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, Check,
  Coffee, CookingPot, Leaf, Menu, Minus, MoveUpRight, Plus, Radio,
  ShoppingBag, Smartphone, Sparkles, Store, UtensilsCrossed, Wifi, X,
} from 'lucide-react'
import logoColor from './assets/logocolor.svg'
import logoWhite from './assets/logowhite.svg'
import './landing.css'

type LandingProps = { onNavigate: (path: string) => void }
const demoPath = '/order/kape-ni-juan?table=T01'

const questions = [
  { question: 'What exactly is AliTapTap?', answer: 'AliTapTap is an NFC-powered ordering experience for cafés, restaurants, and local food businesses. A small card on the table opens your digital menu on a guest’s phone, so they can browse and place an order from their seat.' },
  { question: 'Do my customers need to download an app?', answer: 'No downloads and no customer accounts. Guests unlock an NFC-enabled phone, hold it close to the card, and open the menu link in their browser. They’ll need an internet connection to browse and order.' },
  { question: 'What if a phone doesn’t support NFC?', answer: 'A QR code on the table card provides another way to open the same menu. Guests can scan it with their phone’s camera and follow the link.' },
  { question: 'Can I try it before getting started?', answer: 'Absolutely. Open the interactive menu demo to browse Kape ni Juan’s sample menu and build an order. You can also explore the staff workspace with the demo sign-in details provided on the login page.' },
  { question: 'Does AliTapTap handle payments?', answer: 'For now, payments stay with your business. Guests order through AliTapTap and pay at your counter using your usual payment methods.' },
]

function Brand({ light = false }: { light?: boolean }) {
  return <a className={`lp-brand ${light ? 'lp-brand-light' : ''}`} href="/" aria-label="AliTapTap home">
    <img src={light ? logoWhite : logoColor} width="40" height="44" alt="" />
    <span>AliTapTap<span className="lp-brand-dot">.</span></span>
  </a>
}

function ProductPreview({ onNavigate }: LandingProps) {
  const [tapped, setTapped] = useState(false)
  const [quantity, setQuantity] = useState(0)

  return <div className={`lp-product ${tapped ? 'is-tapped' : ''}`}>
    <div className="lp-product-grid" aria-hidden="true" />
    <div className="lp-sun" aria-hidden="true"><div /><div /></div>
    <img className="lp-hero-firefly" src={logoColor} alt="" aria-hidden="true" />
    <div className="lp-product-note"><span /> A little tech. A little magic.</div>

    <div className="lp-phone">
      <div className="lp-phone-screen">
        <div className="lp-phone-status" aria-hidden="true"><b>9:41</b><span className="lp-phone-island" /><span><Wifi size={12} /><i /></span></div>
        <div className="lp-phone-address"><span /> kapenijuan.menu <span>•••</span></div>
        <div className="lp-phone-cover"><img src="/images/coffee.jpg" alt="Fresh coffee ready to enjoy" width="600" height="400" /><span>GOOD DAYS START HERE.</span><span className="lp-kj-logo">kj<span>coffee & company</span></span></div>
        <div className="lp-phone-content">
          <div className="lp-phone-store"><h3>Kape ni Juan<span>Local coffee. Familiar comfort.</span></h3><span>Table 01</span></div>
          <div className="lp-phone-categories"><b>Our favorites</b><span>Coffee</span><span>Bakes</span></div>
          <div className="lp-phone-item"><div className="lp-coffee-thumb"><img src="/images/coffee.jpg" alt="" width="72" height="76" /></div><div><span className="lp-popular">HOUSE FAVORITE</span><h4>Spanish Latte</h4><span>Sweet, smooth, just right.</span><b>₱145</b></div><button onClick={() => setQuantity(value => value + 1)} aria-label="Add Spanish Latte to preview"><Plus size={13} /></button></div>
          <div className="lp-phone-item lp-phone-item-second"><div className="lp-bake-thumb"><Coffee size={27} strokeWidth={1.3} /></div><div><h4>Sea Salt Latte</h4><span>A little sweet. A little salty.</span><b>₱155</b></div><button onClick={() => setQuantity(value => value + 1)} aria-label="Add Sea Salt Latte to preview"><Plus size={13} /></button></div>
          <button className="lp-phone-order" onClick={() => onNavigate(demoPath)}><ShoppingBag size={13} /><span>{quantity ? `${quantity} ${quantity === 1 ? 'item' : 'items'} added · Try the menu` : 'Explore the demo menu'}</span><ArrowRight size={13} /></button>
          <p className="lp-phone-credit">a little tap, powered by <b>AliTapTap</b></p>
        </div>
        <div className="lp-phone-home" />
      </div>
    </div>

    <div className="lp-tap-notice" role="status"><span><Check size={17} strokeWidth={3} /></span><div><b>{tapped ? 'You’re connected!' : 'Your next favorite, one tap away.'}</b><small>{tapped ? 'Menu opened. Make yourself at home.' : 'No app. Just a little tap.'}</small></div></div>

    <button className="lp-nfc-card" onClick={() => setTapped(value => !value)} aria-label="Tap the NFC card to preview connecting" aria-pressed={tapped}>
      <span className="lp-card-brand"><img src={logoWhite} width="24" height="27" alt="" />AliTapTap<span>01</span></span>
      <span className="lp-card-main"><span>Good things<br />start with a tap<span className="lp-card-dot">.</span></span><span className="lp-card-nfc"><Radio size={36} strokeWidth={1.25} /></span></span>
      <span className="lp-card-bottom"><span>TAP. BROWSE. ENJOY.</span><span>NFC ENABLED <MoveUpRight size={10} /></span></span>
      <span className="lp-card-glow" aria-hidden="true" />
    </button>
    <div className="lp-tap-hint" aria-hidden="true"><ArrowUpRight size={31} strokeWidth={1.3} /><span>Go on, give it a tap.</span></div>
    <div className="lp-product-caption"><span>INTERACTIVE PRODUCT PREVIEW</span><span>TAP TO EXPLORE</span></div>
  </div>
}

const previewOrders = [
  { table: 'Table 04', code: 'KJ-1048', items: '2× Spanish Latte · 1× Ube Ensaymada', price: '₱385', status: 'New' },
  { table: 'Table 02', code: 'KJ-1049', items: '1× Sea Salt Latte · 1× Banana Loaf', price: '₱240', status: 'New' },
  { table: 'Table 01', code: 'KJ-1047', items: '1× Tablea Mocha · 1× Tuna Pandesal', price: '₱275', status: 'Preparing' },
  { table: 'Counter', code: 'KJ-1046', items: '2× Mango Iced Tea', price: '₱250', status: 'Ready' },
]

function WorkspacePreview({ onNavigate }: LandingProps) {
  const [status, setStatus] = useState('New')
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const statuses = ['New', 'Preparing', 'Ready']

  return <div className="lp-workspace">
    <div className="lp-workspace-bar"><span className="lp-window-dots"><i /><i /><i /></span><span>YOUR STAFF WORKSPACE</span><span className="lp-preview-label">DEMO</span></div>
    <div className="lp-workspace-body">
      <div className="lp-workspace-heading"><div><p>KAPE NI JUAN</p><h3>A good day, in the making.</h3></div><span className="lp-workspace-avatar">J</span></div>
      <div className="lp-workspace-subheading"><b>Order board</b><span><span /> Preview</span></div>
      <div className="lp-order-tabs" role="tablist" aria-label="Preview order status">{statuses.map((item, index) => <button key={item} ref={node => { tabRefs.current[index] = node }} id={`order-tab-${item}`} role="tab" aria-selected={status === item} aria-controls="order-preview-panel" tabIndex={status === item ? 0 : -1} className={status === item ? 'active' : ''} onClick={() => setStatus(item)} onKeyDown={event => {
        let next = index
        if (event.key === 'ArrowRight') next = (index + 1) % statuses.length
        else if (event.key === 'ArrowLeft') next = (index + statuses.length - 1) % statuses.length
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = statuses.length - 1
        else return
        event.preventDefault()
        setStatus(statuses[next])
        tabRefs.current[next]?.focus()
      }}>{item}<span>{previewOrders.filter(order => order.status === item).length}</span></button>)}</div>
      <div className="lp-preview-orders" id="order-preview-panel" role="tabpanel" aria-labelledby={`order-tab-${status}`} tabIndex={0}>{previewOrders.filter(order => order.status === status).map(order => <article className="lp-preview-order" key={order.code}><div><span className={`lp-order-indicator lp-order-${status.toLowerCase()}`} /><b>{order.table}</b><small>{order.code}</small></div><p>{order.items}</p><div><strong>{order.price}</strong><span className={`lp-order-state lp-order-${status.toLowerCase()}`}>{status === 'New' ? 'Just came in' : status === 'Preparing' ? 'In the kitchen' : 'Ready to serve'}<ArrowUpRight size={12} /></span></div></article>)}</div>
      <button className="lp-workspace-link" onClick={() => onNavigate('/dashboard/orders')}>Explore the staff demo <ArrowRight size={15} /></button>
    </div>
  </div>
}

export default function Landing({ onNavigate }: LandingProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus() }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  return <div className="landing lp">
    <a href="#main-content" className="lp-skip">Skip to content</a>
    <header className="lp-header">
      <nav className="lp-shell lp-nav" aria-label="Main navigation">
        <Brand />
        <div className="lp-desktop-links"><a href="#how">How it works</a><a href="#business">Why AliTapTap</a><a href="#faq">FAQs</a></div>
        <div className="lp-nav-actions"><button className="lp-signin" onClick={() => onNavigate('/login')}>Staff login <ArrowUpRight size={14} /></button><button className="lp-button lp-button-small" onClick={() => onNavigate(demoPath)}>Try it live <ArrowUpRight size={16} /></button></div>
        <button ref={menuButton} className="lp-menu-toggle" onClick={() => setMenuOpen(value => !value)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="mobile-navigation">{menuOpen ? <X /> : <Menu />}</button>
      </nav>
      {menuOpen && <nav className="lp-mobile-nav" id="mobile-navigation" aria-label="Mobile navigation"><a href="#how" onClick={() => setMenuOpen(false)}>How it works <ArrowDownRight size={18} /></a><a href="#business" onClick={() => setMenuOpen(false)}>Why AliTapTap <ArrowDownRight size={18} /></a><a href="#faq" onClick={() => setMenuOpen(false)}>FAQs <ArrowDownRight size={18} /></a><button onClick={() => onNavigate('/login')}>Staff login <ArrowUpRight size={18} /></button></nav>}
    </header>

    <main id="main-content">
      <section className="lp-hero lp-shell" aria-labelledby="hero-title">
        <div className="lp-hero-copy">
          <div className="lp-eyebrow"><span><Radio size={13} /></span> NFC POWERED. PEOPLE FIRST.</div>
          <h1 id="hero-title">Less waiting.<br />More living.<br /><span>Just tap<span className="lp-title-dot">.</span><svg viewBox="0 0 355 18" fill="none" aria-hidden="true"><path d="M4 11C85 1 208 0 349 8M25 16C150 7 242 7 325 13" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg></span></h1>
          <p>NFC-powered ordering for cafés, restaurants, and local favorites. One phone tap to browse the menu, place an order, and get back to the good stuff.</p>
          <div className="lp-hero-actions"><button className="lp-button" onClick={() => onNavigate(demoPath)}>Experience the tap <ArrowUpRight size={19} /></button><a className="lp-text-link" href="#how"><span className="lp-play"><ArrowDown size={15} /></span>See how it works</a></div>
          <div className="lp-hero-benefits"><span><Check /> No app needed</span><span><Check /> NFC + QR ready</span><span><Check /> Made for local</span></div>
        </div>
        <ProductPreview onNavigate={onNavigate} />
      </section>

      <section className="lp-for-strip" aria-label="Businesses we’re built for"><div className="lp-shell"><p>A LITTLE TAP.<br /><b>RIGHT AT HOME.</b></p><div><Coffee /><span>Cafés & coffee shops</span></div><div><UtensilsCrossed /><span>Restaurants</span></div><div><Store /><span>Food stalls</span></div><div><CookingPot /><span>Local favorites</span></div></div></section>

      <section className="lp-how lp-shell lp-section" id="how" aria-labelledby="how-title">
        <div className="lp-section-heading"><div><p className="lp-kicker"><span /> EFFORTLESS BY DESIGN</p><h2 id="how-title">One tap.<br />And you’re in.</h2></div><p>No waving for a menu. No downloading an app.<br className="lp-desktop-break" /> Just more time for the good stuff.</p></div>
        <div className="lp-steps">
          <article className="lp-step"><div className="lp-step-top"><span>01 /</span><div className="lp-step-icon lp-step-yellow"><Smartphone size={28} strokeWidth={1.5} /><Radio className="lp-mini-radio" size={15} /></div><ArrowRight size={22} /></div><h3>Tap into something good.</h3><p>Hold your phone near the AliTapTap card. Your table’s menu opens right in your browser.</p><span className="lp-step-label"><Radio size={13} /> A LITTLE NFC MAGIC</span></article>
          <article className="lp-step"><div className="lp-step-top"><span>02 /</span><div className="lp-step-icon lp-step-orange"><UtensilsCrossed size={29} strokeWidth={1.5} /></div><ArrowRight size={22} /></div><h3>Find your new favorite.</h3><p>Explore the menu, fill your cart, and send your order. All from the comfort of your seat.</p><span className="lp-step-label"><ShoppingBag size={13} /> YOUR MENU, YOUR MOMENT</span></article>
          <article className="lp-step"><div className="lp-step-top"><span>03 /</span><div className="lp-step-icon lp-step-green"><Sparkles size={29} strokeWidth={1.5} /></div><Check size={22} /></div><h3>Sit back. Savor more.</h3><p>Your team gets a clear, table-linked order. You get back to the conversation. Everybody wins.</p><span className="lp-step-label"><Check size={13} /> GOOD THINGS ARE ON THEIR WAY</span></article>
        </div>
      </section>

      <section className="lp-business" id="business" aria-labelledby="business-title"><div className="lp-shell lp-business-inner">
        <div className="lp-business-copy"><p className="lp-kicker"><span /> SMALL BUSINESS. BIG HEART.</p><h2 id="business-title">Less busywork.<br />More <span>hospitality.</span></h2><p>You bring the good food and warm welcomes.<br className="lp-desktop-break" /> We make the space between a little simpler.</p><ul className="lp-business-benefits"><li><span><Check size={15} /></span><div><h3>Every order, in its place.</h3><p>Items, quantities, and table numbers. Together.</p></div></li><li><span><Check size={15} /></span><div><h3>A little less back and forth.</h3><p>Guests order when they’re ready. Your team stays focused.</p></div></li><li><span><Check size={15} /></span><div><h3>Fits right into your everyday.</h3><p>A table card, a phone, and a browser. Simple by design.</p></div></li></ul><button className="lp-business-link" onClick={() => onNavigate('/dashboard/orders')}>Meet your new workspace <ArrowUpRight size={18} /></button></div>
        <WorkspacePreview onNavigate={onNavigate} />
      </div></section>

      <section className="lp-local lp-shell lp-section" aria-labelledby="local-title"><div className="lp-local-image"><img src="/images/cafe.jpg" alt="A welcoming café with warm lighting and places to gather" width="1200" height="800" loading="lazy" /><span className="lp-local-tag"><img src={logoColor} width="30" height="33" alt="" />A little connection goes a long way.</span></div><div className="lp-local-copy"><p className="lp-kicker"><span /> ROOTED IN THE EVERYDAY</p><h2 id="local-title">For the places<br />that bring us<br /><span>together.</span></h2><p>The neighborhood café. Your go-to lunch spot. The little food stall with a big following.</p><p>AliTapTap is made for local businesses and the people who make them special. Thoughtful technology, with a human touch.</p><div className="lp-local-signoff"><Leaf size={18} /><span>Built with care in the Philippines.</span></div></div></section>

      <section className="lp-faq lp-shell lp-section" id="faq" aria-labelledby="faq-title"><div><p className="lp-kicker"><span /> A LITTLE MORE CLARITY</p><h2 id="faq-title">Good questions.<br />Simple answers.</h2><p>Getting to know your next little upgrade.</p><img className="lp-faq-firefly" src={logoColor} width="80" height="88" alt="" /></div><div className="lp-questions">{questions.map((item, index) => <details key={item.question} className="lp-question"><summary><span className="lp-question-number">0{index + 1}</span><span>{item.question}</span><Plus size={18} className="lp-faq-plus" /><Minus size={18} className="lp-faq-minus" /></summary><p>{item.answer}</p></details>)}</div></section>

      <section className="lp-final-cta lp-shell" aria-labelledby="cta-title"><div className="lp-cta-art" aria-hidden="true"><img src={logoColor} alt="" /></div><div><p className="lp-kicker">YOUR NEXT CHAPTER STARTS HERE</p><h2 id="cta-title">Good things are<br />just a tap away.</h2><p>Take a little look. See what a little tap can do.</p><button className="lp-button" onClick={() => onNavigate(demoPath)}>Give AliTapTap a try <ArrowUpRight size={19} /></button></div><span className="lp-cta-note">No download. No sign-up. Just explore.</span><ArrowUpRight className="lp-cta-arrow" size={160} strokeWidth={.7} aria-hidden="true" /></section>
    </main>

    <footer className="lp-footer"><div className="lp-shell"><div className="lp-footer-top"><div><Brand /><p>A little tap. A brighter connection.</p></div><nav aria-label="Footer navigation"><a href="#how">How it works</a><a href="#business">For businesses</a><a href="#faq">FAQs</a><button onClick={() => onNavigate('/login')}>Staff login <ArrowUpRight size={14} /></button></nav></div><div className="lp-footer-bottom"><p>© {new Date().getFullYear()} AliTapTap. All rights reserved.</p><span><span /> Thoughtfully made in the Philippines.</span><a href="#main-content">Back to top <ArrowUpRight size={14} /></a></div></div></footer>
  </div>
}
