"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "../../data";
import { getProductVolume } from "../../data";
import { addToCart } from "../../cart/cart-storage";
import { Inquiry, ProductArt } from "../../storefront";

export function ProductDetailClient({ product }: { product: Product }) {
  const [ask, setAsk] = useState(false);
  const [added, setAdded] = useState(false);
  const volume = getProductVolume(product);
  const currentPrice = product.promoPrice || product.price;
  const add = () => {
    addToCart(product);
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
          <p className="detail-description">Add this product to your catalogue cart or ask the Barrie store to confirm current availability. Availability requests do not reserve or purchase the product.</p>

          <div className="detail-facts-dark">
            <div><small>Flavour / variant</small><b>{product.flavour || "See product name"}</b></div>
            <div><small>{volume ? "Bottle size" : "Category"}</small><b>{volume || product.category}</b></div>
            <div><small>UPC</small><b>{product.upc}</b></div>
          </div>

          <div className="detail-actions">
            <button className={`detail-add ${added ? "added" : ""}`} onClick={add}>
              <span>{added ? "✓" : "+"}</span>{added ? "Added to cart" : "Add to cart"}
            </button>
            <button className="detail-availability" onClick={() => setAsk(true)}>Check availability <span>↗</span></button>
          </div>
          {added && <Link className="detail-view-cart" href="/cart">View cart and tax estimate →</Link>}

          <div className="detail-assurance">
            <span>01</span><p><b>No online checkout yet</b>Your cart shows the subtotal and Ontario HST, but payment remains disabled until the store receives approval.</p>
            <span>02</span><p><b>Local availability</b>Send a request and Vape Mart will confirm whether this exact item is currently in the Barrie store.</p>
          </div>
        </div>
      </section>
    </div>
    {ask && <Inquiry product={product} close={() => setAsk(false)}/>}
  </main>;
}
