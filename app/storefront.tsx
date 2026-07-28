"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultStoreHours, getProductVolume, products, type Product, store, type StoreHours } from "./data";
import { addToCart, readCart, selectedQuantity } from "./cart/cart-storage";
import { carouselSwipeStep } from "./carousel-swipe";

function Logo() {
  return <Link className="logo" href="/"><span><img src="/brand/vape-mart-logo-small.webp" width="160" height="160" alt="" /></span> VAPE MART</Link>;
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [searchOpen,setSearchOpen]=useState(false);
  const [headerQuery,setHeaderQuery]=useState("");
  const [quantity,setQuantity]=useState(0);
  const [showTop,setShowTop]=useState(false);
  const searchInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const refresh=()=>setQuantity(selectedQuantity(readCart()));
    const scroll=()=>setShowTop(window.scrollY>700);
    refresh();scroll();
    window.addEventListener("vapemart-cart",refresh);
    window.addEventListener("storage",refresh);
    window.addEventListener("scroll",scroll,{passive:true});
    return()=>{window.removeEventListener("vapemart-cart",refresh);window.removeEventListener("storage",refresh);window.removeEventListener("scroll",scroll)};
  },[]);
  useEffect(()=>{if(searchOpen)searchInput.current?.focus()},[searchOpen]);
  return <>
    <AgeGate />
    <div className="warning-bar">WARNING: Vaping products contain nicotine. Nicotine is highly addictive. Adults 19+ only.</div>
    <header className="site-header">
      <Logo />
      <nav className={open ? "nav-open" : ""}>
        <Link href="/#catalogue">Shop catalogue</Link>
        <Link href="/#categories">Categories</Link>
        <Link href="/contact">Visit us</Link>
      </nav>
      <div className="header-actions">
        <button className="header-icon" onClick={()=>setSearchOpen(value=>!value)} aria-label="Search products" aria-expanded={searchOpen} aria-controls="header-search"><span aria-hidden="true">⌕</span></button>
        <Link className="header-icon cart-icon" href="/cart" aria-label={`Cart, ${quantity} selected item${quantity===1?"":"s"}`}><span aria-hidden="true">🛒</span>{quantity>0&&<b aria-hidden="true">{quantity>99?"99+":quantity}</b>}</Link>
        <button className="menu" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open}>Menu</button>
      </div>
      <form id="header-search" className={`header-search ${searchOpen?"open":""}`} action="/#catalogue" method="get" role="search">
        <label htmlFor="header-product-search">Search products</label>
        <input ref={searchInput} id="header-product-search" name="search" value={headerQuery} onChange={event=>setHeaderQuery(event.target.value)} placeholder="Search flavour, product, or brand" autoComplete="off"/>
        {headerQuery&&<button type="button" className="search-clear" onClick={()=>{setHeaderQuery("");searchInput.current?.focus()}} aria-label="Clear search">×</button>}
        <button type="submit" className="search-submit">Search</button>
      </form>
    </header>
    <button className={`back-to-top ${showTop?"visible":""}`} onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} aria-label="Back to top">↑</button>
  </>;
}

export function Footer() {
  return <footer>
    <div><Logo /><p>Your neighbourhood vape catalogue. Browse online, then check availability at our Ontario store.</p></div>
    <div><b>Explore</b><Link href="/#catalogue">Products</Link><Link href="/contact">Contact</Link></div>
    <div><b>Legal</b><Link href="/legal/privacy">Privacy policy</Link><Link href="/legal/terms">Terms of use</Link><Link href="/legal/age-restriction">Age restriction</Link><Link href="/legal/warnings">Vaping warnings</Link></div>
    <div><b>Contact</b><a href={`mailto:${store.email}`}>{store.email}</a><a href={`tel:${store.phone}`}>{store.phone}</a><span>{store.address}</span></div>
    <small>© {new Date().getFullYear()} Vape Mart. Ontario, Canada. Adults 19+ only.</small>
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

export function ProductArt({ product, priority = false }: { product: Product; priority?: boolean }) {
  const [imageFailed,setImageFailed]=useState(false);
  useEffect(()=>setImageFailed(false),[product.image]);
  if (product.image&&!imageFailed) return <div className="product-art product-photo"><img
    src={product.image}
    alt={product.name}
    onError={()=>setImageFailed(true)}
    loading={priority ? "eager" : "lazy"}
    decoding="async"
    fetchPriority={priority ? "high" : "auto"}
    sizes={priority ? "(max-width: 1000px) 52vw, 360px" : "(max-width: 600px) 86vw, (max-width: 900px) 42vw, 22vw"}
  /></div>;
  return <div className="product-art" style={{ "--accent": product.accent } as React.CSSProperties}>
    <span className="art-brand">{product.brand}</span>
    <strong>{product.flavour}</strong>
    <i>{product.puffCount ? `${product.puffCount} PUFFS` : product.category}</i>
  </div>;
}

type AvailabilityProduct = Pick<Product,"id"|"name"|"image">;

export function Inquiry({ product, close, initialQuantity = 1 }: { product: AvailabilityProduct; close: () => void; initialQuantity?: number }) {
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<{id:string;notification:string}|null>(null);
  const [error, setError] = useState("");
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = `availability-${product.id.replace(/[^a-z0-9_-]/gi,"")}`;
  useEffect(()=>{
    const previousOverflow=document.body.style.overflow;
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")close()};
    document.body.style.overflow="hidden";
    window.addEventListener("keydown",escape);
    closeButton.current?.focus();
    return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener("keydown",escape)};
  },[close]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const form = new FormData(e.currentTarget);
      const response = await fetch("/api/inquiries", { method: "POST", body: JSON.stringify({
        productId: product.id, productName: product.name, name: form.get("name"),
        contact: form.get("contact"), quantity: form.get("quantity"),
        message: form.get("message"), website: form.get("website"),
      }), headers: { "content-type": "application/json" } });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "We could not send your request right now.");
      }
      setReceipt({id:String(data?.id||""),notification:String(data?.notification||"saved")});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not send your request right now.");
    } finally {
      setSending(false);
    }
  }
  return <div className="modal-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)close()}}><div className="inquiry-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <button ref={closeButton} className="modal-close" onClick={close} aria-label="Close availability form">×</button>
    {receipt ? <div className="success"><span>✓</span><h2>Request received</h2><p>Our store team will check this product and reply using the contact details you provided.</p>{receipt.id&&<small>Request reference: {receipt.id.slice(0,8).toUpperCase()}</small>}<button className="primary" onClick={close}>Done</button></div> : <>
      <div className="inquiry-product">
        <div className="inquiry-product-image"><span>VM</span>{product.image&&<img src={product.image} alt="" loading="eager" onError={event=>event.currentTarget.remove()}/>}</div>
        <div><p className="eyebrow">In-store availability</p><h2 id={titleId}>{product.name}</h2></div>
      </div>
      <p className="muted">This is an availability request only—not an order or reservation.</p>
      <form onSubmit={submit}>
        <label>Selected quantity<input name="quantity" type="number" min="1" max="99" defaultValue={Math.max(1,Math.min(99,initialQuantity))} required /></label>
        <label>Your name<input name="name" required minLength={2} placeholder="First and last name" /></label>
        <label>Email or phone<input name="contact" required placeholder="you@example.com or (416) 555-0123" /></label>
        <label>Message<textarea name="message" maxLength={1000} rows={4} placeholder="Tell us anything helpful about the product or flavour." /></label>
        <input className="honeypot" name="website" tabIndex={-1} autoComplete="off" />
        {error && <p className="form-error" role="alert">{error} You can also call <a href="tel:+17057218181">(705) 721-8181</a>.</p>}
        <button className="primary" disabled={sending}>{sending ? "Sending…" : "Send availability request"}</button>
      </form>
      <small>By submitting, you agree that Vape Mart may contact you about this request.</small>
    </>}
  </div></div>;
}

export function ProductCard({ product, onAvailability }: { product: Product; onAvailability: (product:Product,quantity:number) => void }) {
  const [added, setAdded] = useState(false);
  const volume = getProductVolume(product);
  return <article className="product-card" data-reveal>
    <Link href={`/products/${product.slug}`} className="product-image"><ProductArt product={product} />{product.promoPrice && <span className="sale-badge">Sale</span>}</Link>
    <div className="product-meta"><span>{product.brand} · {product.category}{volume ? ` · ${volume}` : ""}</span><h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
      <div className="price">{product.promoPrice ? <><del>${product.price.toFixed(2)}</del> ${product.promoPrice.toFixed(2)}</> : `$${product.price.toFixed(2)}`}</div>
      <button className="primary add-cart" onClick={()=>{addToCart(product);setAdded(true);window.setTimeout(()=>setAdded(false),1600)}}>{added?"Added to Cart ✓":"Add to Cart"}</button>
      <button className="outline-button" onClick={() => onAvailability(product,readCart().find(item=>item.id===product.id)?.quantity||1)}>Check availability <span>→</span></button>
    </div>
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

export function categoryImageFor(category: string) {
  const key = category.toLowerCase().replace(/[^a-z]/g, "");
  if (key.includes("accessor")) return "/products/catalog/stlth-loop-max-black-battery-01544.webp";
  if (key.includes("closepod") || key.includes("closedpod")) return "/products/catalog/loop-25k-peach-blue-razz-ice-95034.webp";
  if (key.includes("disposable")) return "/products/flavour-beast-50k/fb-50k-bomb-blue-razz-82367.webp";
  if (key.includes("eliquid")) return "/products/catalog/flavour-beast-60ml-weekend-watermelon-40152.webp";
  if (key === "pods" || key.includes("pod")) return "/products/catalog/zpods-strawberry-45267.webp";
  return "/products/catalog/stlth-loop-max-black-battery-01544.webp";
}

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
  const pointer = useRef<{id:number;x:number;y:number;horizontal:boolean}|null>(null);
  const dragged = useRef(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setActive(value => (value + 1) % banners.length), 5500);
    return () => window.clearInterval(timer);
  }, [paused,banners.length]);
  const select = (index: number) => setActive((index + banners.length) % banners.length);
  const move = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--hero-x", `${((event.clientX - bounds.left) / bounds.width - .5) * 1.8}deg`);
    event.currentTarget.style.setProperty("--hero-y", `${((event.clientY - bounds.top) / bounds.height - .5) * -1.2}deg`);
  };
  const reset = (element: HTMLElement) => {
    element.style.setProperty("--hero-x", "0deg");
    element.style.setProperty("--hero-y", "0deg");
    element.style.setProperty("--hero-drag", "0px");
  };
  const touchStart = (event: React.PointerEvent<HTMLElement>) => {
    if(event.pointerType!=="touch"&&event.pointerType!=="pen")return;
    pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY,horizontal:false};
    dragged.current=false;
    setPaused(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const touchMove = (event: React.PointerEvent<HTMLElement>) => {
    const start=pointer.current;
    if(!start||start.id!==event.pointerId)return;
    const dx=event.clientX-start.x;
    const dy=event.clientY-start.y;
    if(!start.horizontal&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.15)start.horizontal=true;
    if(start.horizontal){
      event.preventDefault();
      dragged.current=true;
      event.currentTarget.style.setProperty("--hero-drag",`${Math.max(-90,Math.min(90,dx))}px`);
    }
  };
  const touchEnd = (event: React.PointerEvent<HTMLElement>) => {
    const start=pointer.current;
    if(!start||start.id!==event.pointerId)return;
    const dx=event.clientX-start.x;
    const dy=event.clientY-start.y;
    const step=start.horizontal?carouselSwipeStep(dx,dy):0;
    if(step)select(active+step);
    pointer.current=null;
    reset(event.currentTarget);
    setPaused(false);
  };
  return <section
    className="hero-carousel"
    aria-label="New arrivals"
    aria-roledescription="carousel"
    onMouseEnter={() => setPaused(true)}
    onMouseLeave={event => { if(!pointer.current)setPaused(false); reset(event.currentTarget); }}
    onPointerDown={touchStart}
    onPointerMove={move}
    onPointerMoveCapture={touchMove}
    onPointerUp={touchEnd}
    onPointerCancel={event => { pointer.current=null;setPaused(false);reset(event.currentTarget); }}
  >
    <div className="banner-stack">
      {banners.map((banner, index) => <a
        className={`banner-slide ${index === active ? "active" : ""}`}
        href="#catalogue"
        aria-hidden={index !== active}
        tabIndex={index === active ? 0 : -1}
        onClick={event=>{if(dragged.current){event.preventDefault();dragged.current=false}}}
        key={banner.src}
      ><img src={banner.src} alt={banner.alt} loading={index === active ? "eager" : "lazy"} decoding="async" fetchPriority={index === active ? "high" : "low"}/></a>)}
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

function MotionLayer() {
  const progress = useRef<HTMLDivElement>(null);
  const halo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = reduced ? null : new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer?.unobserve(entry.target);
        }
      });
    }, { threshold: .08, rootMargin: "0px 0px -4%" });
    const observeNewElements = () => {
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.motion-ready)").forEach((element, index) => {
        element.classList.add("motion-ready");
        element.style.setProperty("--reveal-delay", `${Math.min(index % 8, 5) * 45}ms`);
        if (observer) observer.observe(element);
        else element.classList.add("revealed");
      });
    };
    const mutation = new MutationObserver(observeNewElements);
    const updateProgress = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      progress.current?.style.setProperty("--page-progress", String(available > 0 ? window.scrollY / available : 0));
    };
    const followPointer = (event: PointerEvent) => {
      if (!halo.current || event.pointerType === "touch") return;
      halo.current.style.left = `${event.clientX}px`;
      halo.current.style.top = `${event.clientY}px`;
      halo.current.classList.add("visible");
    };
    observeNewElements();
    mutation.observe(document.body, { childList: true, subtree: true });
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    window.addEventListener("pointermove", followPointer, { passive: true });
    return () => {
      observer?.disconnect();
      mutation.disconnect();
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      window.removeEventListener("pointermove", followPointer);
    };
  }, []);
  return <><div className="scroll-progress" ref={progress} aria-hidden="true"/><div className="pointer-halo" ref={halo} aria-hidden="true"/></>;
}

export function Storefront({ catalogue = products, banners = defaultArrivalBanners, storeHours = defaultStoreHours }: { catalogue?: Product[];banners?:{src:string;alt:string}[];storeHours?:StoreHours }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All products");
  const [brand, setBrand] = useState("All brands");
  const [priceRange, setPriceRange] = useState("all");
  const [sort,setSort]=useState("featured");
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [limit, setLimit] = useState(12);
  const [availability,setAvailability]=useState<{product:Product;quantity:number}|null>(null);
  const categories = useMemo(()=>["All products",...Array.from(new Set(catalogue.map(product=>product.category))).sort()],[catalogue]);
  const brands = useMemo(()=>["All brands",...Array.from(new Set(catalogue.map(product=>product.brand))).sort()],[catalogue]);
  const selectedPrice = priceRanges.find(range => range.value === priceRange) || priceRanges[0];
  const filtered = useMemo(() => catalogue.filter(p =>
    (category === "All products" || p.category === category) &&
    (brand === "All brands" || p.brand === brand) &&
    p.price >= selectedPrice.min && p.price < selectedPrice.max &&
    `${p.name} ${p.brand} ${p.flavour}`.toLowerCase().includes(query.toLowerCase())
  ), [query, category, brand, selectedPrice, catalogue]);
  const sorted=useMemo(()=>[...filtered].sort((a,b)=>{
    if(sort==="price-low")return (a.promoPrice||a.price)-(b.promoPrice||b.price);
    if(sort==="price-high")return (b.promoPrice||b.price)-(a.promoPrice||a.price);
    if(sort==="name")return a.name.localeCompare(b.name);
    return Number(b.featured)-Number(a.featured);
  }),[filtered,sort]);
  useEffect(() => setLimit(12), [query, category, brand, priceRange,sort]);
  useEffect(()=>{
    const incoming=new URLSearchParams(window.location.search).get("search");
    if(incoming){setQuery(incoming);window.setTimeout(()=>document.querySelector("#catalogue")?.scrollIntoView(),0)}
  },[]);
  const clearFilters=()=>{
    setQuery("");setCategory("All products");setBrand("All brands");setPriceRange("all");setSort("featured");
    const url=new URL(window.location.href);url.searchParams.delete("search");window.history.replaceState(null,"",`${url.pathname}${url.hash}`);
  };
  return <><MotionLayer /><Header /><main>
    <HeroCarousel banners={banners.length?banners:defaultArrivalBanners} />

    <section className="trust-strip" data-reveal><span>19+ age verified</span><span>Ontario retail store</span><span>Fast availability replies</span><span>Trusted brands</span></section>

    <section id="categories" className="section category-section" data-reveal><p className="eyebrow">Browse your way</p><div className="section-heading"><h2>Shop by category</h2><a href="#catalogue">View all products →</a></div>
      <div className="category-grid">{categories.slice(1).map(cat => <button data-reveal key={cat} onClick={() => { setCategory(cat); document.querySelector("#catalogue")?.scrollIntoView({ behavior: "smooth" }); }}>
        <span className="category-photo"><img src={categoryImageFor(cat)} loading="lazy" decoding="async" alt="" /></span>
        <span className="category-copy"><b>{cat}</b><small>{catalogue.filter(p => p.category === cat).length} products</small></span>
      </button>)}</div>
    </section>

    <section id="catalogue" className="section catalogue-section" data-reveal><p className="eyebrow">The catalogue</p><div className="section-heading"><h2>What are you looking for?</h2><span>{sorted.length} products</span></div>
      <div className="category-scroll" aria-label="Product categories">{categories.map(item=><button className={category===item?"active":""} onClick={()=>setCategory(item)} key={item}>{item}</button>)}</div>
      <button className="mobile-filter-toggle" onClick={()=>setFiltersOpen(value=>!value)} aria-expanded={filtersOpen} aria-controls="catalogue-filters">Filter &amp; Sort <span>{filtersOpen?"−":"+"}</span></button>
      <div id="catalogue-filters" className={`catalogue-controls ${filtersOpen?"mobile-open":""}`}>
        <label className="search"><span aria-hidden="true">⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search flavour, product, or brand" aria-label="Search catalogue"/>{query&&<button type="button" onClick={()=>{setQuery("");const url=new URL(window.location.href);url.searchParams.delete("search");window.history.replaceState(null,"",`${url.pathname}${url.hash}`)}} aria-label="Clear catalogue search">×</button>}</label>
        <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter by category">{categories.map(x => <option key={x}>{x}</option>)}</select>
        <select value={brand} onChange={e => setBrand(e.target.value)} aria-label="Filter by brand">{brands.map(x => <option key={x}>{x}</option>)}</select>
        <select value={priceRange} onChange={e => setPriceRange(e.target.value)} aria-label="Filter by price">{priceRanges.map(range => <option value={range.value} key={range.value}>{range.label}</option>)}</select>
        <select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort products"><option value="featured">Featured first</option><option value="name">Name A–Z</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select>
      </div>
      {sorted.length ? <><div className="product-grid">{sorted.slice(0, limit).map(p => <ProductCard product={p} onAvailability={(product,quantity)=>setAvailability({product,quantity})} key={p.id} />)}</div>{limit < sorted.length && <div className="load-more"><button className="primary" onClick={() => setLimit(value => value + 24)}>Load more products</button><small>Showing {Math.min(limit, sorted.length)} of {sorted.length}</small></div>}</> : <div className="empty-state"><b>No products found</b><p>Try a different search or clear your filters.</p><button className="primary" onClick={clearFilters}>Clear search &amp; filters</button></div>}
    </section>

    <section className="visit" data-reveal><div><p className="eyebrow">Come say hello</p><h2>Your local Vape Mart</h2><p>See something you like? Check availability, then visit our Barrie store for age-verified, in-person service.</p><Link className="primary" href="/contact">Store details & hours</Link></div><div className="hours-card"><b>Weekday hours</b><strong>{storeHours.weekdays}</strong><span>{store.address}</span></div></section>
  </main><Footer />{availability&&<Inquiry product={availability.product} initialQuantity={availability.quantity} close={()=>setAvailability(null)}/>}</>;
}
