"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { brands, categories, products, type Product, store } from "./data";

function Logo() {
  return <Link className="logo" href="/"><span>V</span> VAPE MART</Link>;
}

export function Header() {
  const [open, setOpen] = useState(false);
  return <>
    <div className="warning-bar">WARNING: Vaping products contain nicotine. Nicotine is highly addictive. Adults 19+ only.</div>
    <header>
      <Logo />
      <button className="menu" onClick={() => setOpen(!open)} aria-label="Toggle menu">Menu</button>
      <nav className={open ? "nav-open" : ""}>
        <Link href="/#catalogue">Shop catalogue</Link>
        <Link href="/#categories">Categories</Link>
        <Link href="/contact">Visit us</Link>
        <Link className="nav-admin" href="/admin">Admin</Link>
      </nav>
    </header>
  </>;
}

export function Footer() {
  return <footer>
    <div><Logo /><p>Your neighbourhood vape catalogue. Browse online, then check availability at our Ontario store.</p></div>
    <div><b>Explore</b><Link href="/#catalogue">Products</Link><Link href="/contact">Contact</Link><Link href="/admin">Admin dashboard</Link></div>
    <div><b>Legal</b><Link href="/legal/privacy">Privacy policy</Link><Link href="/legal/terms">Terms of use</Link><Link href="/legal/age-restriction">Age restriction</Link><Link href="/legal/warnings">Vaping warnings</Link></div>
    <div><b>Contact</b><a href={`mailto:${store.email}`}>{store.email}</a><a href={`tel:${store.phone}`}>{store.phone}</a><span>{store.address}</span></div>
    <small>© {new Date().getFullYear()} Vape Mart. Ontario, Canada. No online sales or delivery. Adults 19+ only.</small>
  </footer>;
}

function AgeGate() {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(localStorage.getItem("vapemart-age-ok") !== "yes"), []);
  if (!visible) return null;
  return <div className="age-overlay" role="dialog" aria-modal="true" aria-labelledby="age-title">
    <div className="age-card">
      <div className="age-mark">19+</div>
      <p className="eyebrow">Age verification</p>
      <h2 id="age-title">Are you 19 or older?</h2>
      <p>You must be of legal age in Ontario to view this website. By entering, you confirm you are at least 19 years old.</p>
      <button className="primary" onClick={() => { localStorage.setItem("vapemart-age-ok", "yes"); setVisible(false); }}>Yes, I am 19 or older</button>
      <a className="secondary-button" href="https://www.canada.ca/en/health-canada/services/smoking-tobacco/vaping.html">No, take me to Health Canada</a>
      <small>Vaping products may contain nicotine. Nicotine is highly addictive.</small>
    </div>
  </div>;
}

export function ProductArt({ product }: { product: Product }) {
  return <div className="product-art" style={{ "--accent": product.accent } as React.CSSProperties}>
    <span className="art-brand">{product.brand}</span>
    <strong>{product.flavour}</strong>
    <i>{product.puffCount ? `${product.puffCount} PUFFS` : product.category}</i>
  </div>;
}

function Inquiry({ product, close }: { product: Product; close: () => void }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    const form = new FormData(e.currentTarget);
    const response = await fetch("/api/inquiries", { method: "POST", body: JSON.stringify({
      productId: product.id, productName: product.name, name: form.get("name"),
      contact: form.get("contact"), website: form.get("website"),
    }), headers: { "content-type": "application/json" } });
    setSending(false);
    setSent(response.ok);
  }
  return <div className="modal-backdrop" onMouseDown={close}><div className="inquiry-modal" onMouseDown={e => e.stopPropagation()}>
    <button className="modal-close" onClick={close} aria-label="Close">×</button>
    {sent ? <div className="success"><span>✓</span><h2>Request received</h2><p>We’ll check the store and reply using the contact details you provided.</p><button className="primary" onClick={close}>Done</button></div> : <>
      <p className="eyebrow">In-store availability</p><h2>Check {product.name}</h2>
      <p className="muted">This is an availability request only—not an order or reservation.</p>
      <form onSubmit={submit}>
        <label>Your name<input name="name" required minLength={2} placeholder="First and last name" /></label>
        <label>Email or phone<input name="contact" required placeholder="you@example.com or (416) 555-0123" /></label>
        <input className="honeypot" name="website" tabIndex={-1} autoComplete="off" />
        <button className="primary" disabled={sending}>{sending ? "Sending…" : "Send availability request"}</button>
      </form>
      <small>By submitting, you agree that Vape Mart may contact you about this request.</small>
    </>}
  </div></div>;
}

export function ProductCard({ product }: { product: Product }) {
  const [ask, setAsk] = useState(false);
  return <article className="product-card">
    <Link href={`/products/${product.slug}`} className="product-image"><ProductArt product={product} />{product.promoPrice && <span className="sale-badge">Sale</span>}</Link>
    <div className="product-meta"><span>{product.brand} · {product.category}</span><h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
      <div className="price">{product.promoPrice ? <><del>${product.price.toFixed(2)}</del> ${product.promoPrice.toFixed(2)}</> : `$${product.price.toFixed(2)}`}</div>
      <button className="outline-button" onClick={() => setAsk(true)}>Check availability <span>→</span></button>
    </div>
    {ask && <Inquiry product={product} close={() => setAsk(false)} />}
  </article>;
}

export function Storefront() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All products");
  const [brand, setBrand] = useState("All brands");
  const filtered = useMemo(() => products.filter(p =>
    (category === "All products" || p.category === category) &&
    (brand === "All brands" || p.brand === brand) &&
    `${p.name} ${p.brand} ${p.flavour}`.toLowerCase().includes(query.toLowerCase())
  ), [query, category, brand]);
  return <><AgeGate /><Header /><main>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow">Ontario · Adults 19+ only</p><h1>Find your flavour.<br/><em>Check it in store.</em></h1>
        <p>Browse our catalogue, explore trusted brands, and send a quick availability request before you visit.</p>
        <div className="hero-actions"><a className="primary" href="#catalogue">Browse products</a><Link className="text-link" href="/contact">Visit the store →</Link></div>
        <div className="hero-note"><span>✓</span> Catalogue only — no online ordering, shipping, or delivery</div>
      </div>
      <div className="hero-visual"><div className="float-card card-a"><ProductArt product={products[2]} /></div><div className="float-card card-b"><ProductArt product={products[0]} /></div><div className="circle-label">NEW<br/><b>FLAVOURS</b></div></div>
    </section>

    <section className="trust-strip"><span>19+ age verified</span><span>Ontario retail store</span><span>Fast availability replies</span><span>Trusted brands</span></section>

    <section id="categories" className="section category-section"><p className="eyebrow">Browse your way</p><div className="section-heading"><h2>Shop by category</h2><a href="#catalogue">View all products →</a></div>
      <div className="category-grid">{categories.slice(1).map((cat, i) => <button key={cat} onClick={() => { setCategory(cat); document.querySelector("#catalogue")?.scrollIntoView({ behavior: "smooth" }); }}><span>{["✦","◈","◉"][i]}</span><b>{cat}</b><small>{products.filter(p => p.category === cat).length} products</small></button>)}</div>
    </section>

    <section className="promo-band"><div><p className="eyebrow">This week in store</p><h2>Featured flavours.<br/>Limited-time prices.</h2><p>Promotions are available at the physical store while quantities last.</p><a className="light-button" href="#catalogue">Explore featured products</a></div><div className="promo-type">SAVE<br/><strong>$5</strong><small>on selected items</small></div></section>

    <section id="catalogue" className="section catalogue-section"><p className="eyebrow">The catalogue</p><div className="section-heading"><h2>What are you looking for?</h2><span>{filtered.length} products</span></div>
      <div className="catalogue-controls">
        <label className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search flavour, product, or brand" /></label>
        <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter by category">{categories.map(x => <option key={x}>{x}</option>)}</select>
        <select value={brand} onChange={e => setBrand(e.target.value)} aria-label="Filter by brand">{brands.map(x => <option key={x}>{x}</option>)}</select>
      </div>
      {filtered.length ? <div className="product-grid">{filtered.map(p => <ProductCard product={p} key={p.id} />)}</div> : <div className="empty-state"><b>No matches yet.</b><p>Try a different flavour, brand, or category.</p></div>}
    </section>

    <section className="visit"><div><p className="eyebrow">Come say hello</p><h2>Your local Vape Mart</h2><p>See something you like? Check availability, then visit our Ontario store for age-verified, in-person service.</p><Link className="primary" href="/contact">Store details & hours</Link></div><div className="hours-card"><b>Today’s hours</b><strong>10:00 AM — 9:00 PM</strong><span>{store.address}</span></div></section>
  </main><Footer /></>;
}
