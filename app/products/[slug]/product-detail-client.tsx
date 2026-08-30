"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "../../data";
import { getProductVolume } from "../../data";
import { addToCart } from "../../cart/cart-storage";
import { Inquiry, ProductArt } from "../../storefront";

export function ProductDetailClient({ product, related = [] }: { product: Product; related?: Product[] }) {
  const [ask, setAsk] = useState(false);
  const [added, setAdded] = useState(false);
  const [quantity,setQuantity]=useState(1);
  const volume = getProductVolume(product);
  const currentPrice = product.promoPrice || product.price;
  const add = () => {
    for(let index=0;index<quantity;index++)addToCart(product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return <main className="product-detail-page">
    <div className="product-detail-shell">
      <Link className="product-back" href="/#catalogue"><span>←</span> Back to catalogue</Link>
      <section className="product-detail-layout">
        <div className="detail-visual-stage">
          <span className="detail-stage-label">Front view</span>
          <div className="detail-orbit orbit-large" aria-hidden="true"></div>
          <div className="detail-orbit orbit-small" aria-hidden="true"></div>
          <div className="detail-product-art"><ProductArt product={product} priority/></div>
          <div className="detail-stage-foot"><span>19+ Ontario</span><span>In-store catalogue</span></div>
        </div>

        <div className="detail-information">
          <p className="detail-kicker">{product.brand} <i></i> {product.category}</p>
          <h1>{product.name}</h1>
          <div className="detail-price">
            {product.promoPrice && <del>${product.price.toFixed(2)}</del>}
            <strong>${currentPrice.toFixed(2)}</strong>
            {product.promoPrice && <span>Promotional price</span>}
          </div>
          <p className="detail-description">Add this product to your cart or ask our Barrie store to confirm current in-store availability.</p>

          <div className="detail-facts-dark">
            <div><small>Flavour / variant</small><b>{product.flavour || "See product name"}</b></div>
            <div><small>{volume ? "Bottle size" : "Category"}</small><b>{volume || product.category}</b></div>
            <div><small>UPC</small><b>{product.upc}</b></div>
          </div>

          <div className="detail-quantity"><span>Quantity</span><div><button onClick={()=>setQuantity(value=>Math.max(1,value-1))} aria-label="Decrease quantity">−</button><b>{quantity}</b><button onClick={()=>setQuantity(value=>Math.min(99,value+1))} aria-label="Increase quantity">+</button></div></div>

          <div className="detail-actions">
            <button className={`detail-add ${added ? "added" : ""}`} onClick={add}>
              <span>{added ? "✓" : "+"}</span>{added ? "Added to Cart" : "Add to Cart"}
            </button>
            <button className="detail-availability" onClick={() => setAsk(true)}>Check availability <span>↗</span></button>
          </div>
          {added && <Link className="detail-view-cart" href="/cart">View Cart →</Link>}

          <div className="detail-assurance">
            <span>01</span><p><b>Build your cart</b>Keep products together while you browse and review an estimated total with Ontario HST.</p>
            <span>02</span><p><b>Local availability</b>Send a request and Vape Mart will confirm whether this exact item is currently in the Barrie store.</p>
          </div>
        </div>
      </section>
      {related.length>0&&<section className="detail-related"><p className="eyebrow">Continue browsing</p><h2>More from {product.category}</h2><div>{related.map(item=><Link href={`/products/${item.slug}`} key={item.id}><ProductArt product={item}/><span>{item.brand}</span><b>{item.name}</b><strong>${(item.promoPrice||item.price).toFixed(2)}</strong></Link>)}</div></section>}
    </div>
    {ask && <Inquiry product={product} initialQuantity={quantity} close={() => setAsk(false)}/>}
  </main>;
}
