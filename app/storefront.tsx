"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getProductVolume, products, type Product, store } from "./data";
import { addToCart } from "./cart/cart-storage";

function Logo() {
  return <Link className="logo" href="/"><span><img src="/brand/vape-mart-logo.png" alt="" /></span> VAPE MART</Link>;
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
        <Link className="nav-cart" href="/cart">Cart</Link>
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
  if (product.image) return <div className="product-art product-photo"><img src={product.image} alt="" /></div>;
  return <div className="product-art" style={{ "--accent": product.accent } as React.CSSProperties}>
    <span className="art-brand">{product.brand}</span>
    <strong>{product.flavour}</strong>
    <i>{product.puffCount ? `${product.puffCount} PUFFS` : product.category}</i>
  </div>;
}

function Inquiry({ product, close }: { product: Product; close: () => void }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const form = new FormData(e.currentTarget);
      const response = await fetch("/api/inquiries", { method: "POST", body: JSON.stringify({
        productId: product.id, productName: product.name, name: form.get("name"),
        contact: form.get("contact"), website: form.get("website"),
      }), headers: { "content-type": "application/json" } });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) throw new Error("Your sign-in has expired. Refresh the page and sign in again.");
        throw new Error(data?.error || "We could not send your request right now.");
      }
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not send your request right now.");
    } finally {
      setSending(false);
    }
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
        {error && <p className="form-error" role="alert">{error} You can also call <a href="tel:+17057218181">(705) 721-8181</a>.</p>}
        <button className="primary" disabled={sending}>{sending ? "Sending…" : "Send availability request"}</button>
      </form>
      <small>By submitting, you agree that Vape Mart may contact you about this request.</small>
    </>}
  </div></div>;
}

export function ProductCard({ product }: { product: Product }) {
  const [ask, setAsk] = useState(false);
  const [added, setAdded] = useState(false);
  const volume = getProductVolume(product);
  return <article className="product-card">
    <Link href={`/products/${product.slug}`} className="product-image"><ProductArt product={product} />{product.promoPrice && <span className="sale-badge">Sale</span>}</Link>
    <div className="product-meta"><span>{product.brand} · {product.category}{volume ? ` · ${volume}` : ""}</span><h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
      <div className="price">{product.promoPrice ? <><del>${product.price.toFixed(2)}</del> ${product.promoPrice.toFixed(2)}</> : `$${product.price.toFixed(2)}`}</div>
      <button className="primary add-cart" onClick={()=>{addToCart(product);setAdded(true);window.setTimeout(()=>setAdded(false),1600)}}>{added?"Added to cart ✓":"Add to cart"}</button>
      <button className="outline-button" onClick={() => setAsk(true)}>Check availability <span>→</span></button>
    </div>
    {ask && <Inquiry product={product} close={() => setAsk(false)} />}
  </article>;
}

export const defaultArrivalBanners = [
  {
    src: "/banners/envi-apex-new-arrivals.webp",
    alt: "Envi Apex 2500 new arrivals — 13 flavours now in the Vape Mart catalogue",
  },
  {
    src: "/banners/flavour-beast-60ml.webp",
    alt: "Flavour Beast 60 millilitre e-liquid collection",
  },
  {
    src: "/banners/sour-gushin-60ml.webp",
    alt: "Sour Gushin 60 millilitre new flavours",
  },
];

const categoryImages: Record<string, string> = {
  Accessories: "/products/catalog/stlth-loop-max-black-battery-01544.webp",
  "Closed Pod Systems": "/products/catalog/loop-25k-peach-blue-razz-ice-95034.webp",
  Disposables: "/products/flavour-beast-50k/fb-50k-bomb-blue-razz-82367.webp",
  "E-Liquids": "/products/catalog/flavour-beast-60ml-weekend-watermelon-40152.webp",
  Pods: "/products/catalog/zpods-strawberry-45267.webp",
};

const priceRanges = [
  { value: "all", label: "All prices", min: 0, max: Infinity },
  { value: "under-20", label: "Under $20", min: 0, max: 20 },
  { value: "20-30", label: "$20 – $29.99", min: 20, max: 30 },
  { value: "30-40", label: "$30 – $39.99", min: 30, max: 40 },
  { value: "40-50", label: "$40 – $49.99", min: 40, max: 50 },
  { value: "50-plus", label: "$50 and over", min: 50, max: Infinity },
];

function HeroCarousel({banners}:{banners:{src:string;alt:string}[]}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setActive(value => (value + 1) % banners.length), 5500);
    return () => window.clearInterval(timer);
  }, [paused,banners.length]);
  const select = (index: number) => setActive((index + banners.length) % banners.length);
  return <section
    className="hero-carousel"
    aria-label="New arrivals"
    aria-roledescription="carousel"
    onMouseEnter={() => setPaused(true)}
    onMouseLeave={() => setPaused(false)}
  >
    <div className="banner-stack">
      {banners.map((banner, index) => <a
        className={`banner-slide ${index === active ? "active" : ""}`}
        href="#catalogue"
        aria-hidden={index !== active}
        tabIndex={index === active ? 0 : -1}
        key={banner.src}
      ><img src={banner.src} alt={banner.alt}/></a>)}
    </div>
    <button className="carousel-arrow previous" onClick={() => select(active - 1)} aria-label="Previous poster">←</button>
    <button className="carousel-arrow next" onClick={() => select(active + 1)} aria-label="Next poster">→</button>
    <div className="carousel-dots">
      {banners.map((banner, index) => <button
        className={index === active ? "active" : ""}
        onClick={() => select(index)}
        aria-label={`Show banner ${index + 1}: ${banner.alt}`}
        aria-current={index === active}
        key={banner.src}
      />)}
    </div>
  </section>;
}

export function Storefront({ catalogue = products, banners = defaultArrivalBanners }: { catalogue?: Product[];banners?:{src:string;alt:string}[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All products");
  const [brand, setBrand] = useState("All brands");
  const [priceRange, setPriceRange] = useState("all");
  const [limit, setLimit] = useState(24);
  const categories = useMemo(()=>["All products",...Array.from(new Set(catalogue.map(product=>product.category))).sort()],[catalogue]);
  const brands = useMemo(()=>["All brands",...Array.from(new Set(catalogue.map(product=>product.brand))).sort()],[catalogue]);
  const selectedPrice = priceRanges.find(range => range.value === priceRange) || priceRanges[0];
  const filtered = useMemo(() => catalogue.filter(p =>
    (category === "All products" || p.category === category) &&
    (brand === "All brands" || p.brand === brand) &&
    p.price >= selectedPrice.min && p.price < selectedPrice.max &&
    `${p.name} ${p.brand} ${p.flavour}`.toLowerCase().includes(query.toLowerCase())
  ), [query, category, brand, selectedPrice, catalogue]);
  useEffect(() => setLimit(24), [query, category, brand, priceRange]);
  return <><AgeGate /><Header /><main>
    <HeroCarousel banners={banners.length?banners:defaultArrivalBanners} />

    <section className="trust-strip"><span>19+ age verified</span><span>Ontario retail store</span><span>Fast availability replies</span><span>Trusted brands</span></section>

    <section id="categories" className="section category-section"><p className="eyebrow">Browse your way</p><div className="section-heading"><h2>Shop by category</h2><a href="#catalogue">View all products →</a></div>
      <div className="category-grid">{categories.slice(1).map(cat => <button key={cat} onClick={() => { setCategory(cat); document.querySelector("#catalogue")?.scrollIntoView({ behavior: "smooth" }); }}>
        <span className="category-photo"><img src={categoryImages[cat]} alt="" /></span>
        <span className="category-copy"><b>{cat}</b><small>{catalogue.filter(p => p.category === cat).length} products</small></span>
      </button>)}</div>
    </section>

    <section id="catalogue" className="section catalogue-section"><p className="eyebrow">The catalogue</p><div className="section-heading"><h2>What are you looking for?</h2><span>{filtered.length} products</span></div>
      <div className="catalogue-controls">
        <label className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search flavour, product, or brand" /></label>
        <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter by category">{categories.map(x => <option key={x}>{x}</option>)}</select>
        <select value={brand} onChange={e => setBrand(e.target.value)} aria-label="Filter by brand">{brands.map(x => <option key={x}>{x}</option>)}</select>
        <select value={priceRange} onChange={e => setPriceRange(e.target.value)} aria-label="Filter by price">{priceRanges.map(range => <option value={range.value} key={range.value}>{range.label}</option>)}</select>
      </div>
      {filtered.length ? <><div className="product-grid">{filtered.slice(0, limit).map(p => <ProductCard product={p} key={p.id} />)}</div>{limit < filtered.length && <div className="load-more"><button className="primary" onClick={() => setLimit(value => value + 24)}>Load more products</button><small>Showing {Math.min(limit, filtered.length)} of {filtered.length}</small></div>}</> : <div className="empty-state"><b>No matches yet.</b><p>Try a different flavour, brand, or category.</p></div>}
    </section>

    <section className="visit"><div><p className="eyebrow">Come say hello</p><h2>Your local Vape Mart</h2><p>See something you like? Check availability, then visit our Barrie store for age-verified, in-person service.</p><Link className="primary" href="/contact">Store details & hours</Link></div><div className="hours-card"><b>Weekday hours</b><strong>9:00 AM — 10:00 PM</strong><span>{store.address}</span></div></section>
  </main><Footer /></>;
}
