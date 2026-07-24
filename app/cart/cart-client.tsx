"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readCart, writeCart, type CartItem } from "./cart-storage";

const money=(value:number)=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(value);

export function CartClient(){
  const [items,setItems]=useState<CartItem[]>([]);
  useEffect(()=>setItems(readCart()),[]);
  const subtotal=useMemo(()=>items.reduce((sum,item)=>sum+item.price*item.quantity,0),[items]);
  const tax=Math.round(subtotal*0.13*100)/100;
  const total=subtotal+tax;
  function update(id:string,quantity:number){
    const next=items.flatMap(item=>item.id===id?(quantity>0?[{...item,quantity:Math.min(99,quantity)}]:[]):[item]);
    setItems(next);writeCart(next);
  }
  if(!items.length)return <div className="cart-empty"><span>0</span><h1>Your cart is empty</h1><p>Add products from the catalogue to prepare an estimated order.</p><Link className="primary" href="/#catalogue">Browse products</Link></div>;
  return <div className="cart-layout">
    <section className="cart-items"><p className="eyebrow">Your selection</p><h1>Shopping cart</h1>
      <p className="muted">This cart is for planning only. Checkout and payment are not available yet.</p>
      {items.map(item=><article className="cart-row" key={item.id}>
        <div className="cart-thumb">{item.image?<img src={item.image} alt=""/>:<span>VM</span>}</div>
        <div><Link href={`/products/${item.slug}`}><b>{item.name}</b></Link><small>{money(item.price)} each</small></div>
        <div className="quantity"><button onClick={()=>update(item.id,item.quantity-1)} aria-label={`Decrease ${item.name}`}>−</button><span>{item.quantity}</span><button onClick={()=>update(item.id,item.quantity+1)} aria-label={`Increase ${item.name}`}>+</button></div>
        <strong>{money(item.price*item.quantity)}</strong>
        <button className="remove" onClick={()=>update(item.id,0)}>Remove</button>
      </article>)}
    </section>
    <aside className="cart-summary"><p className="eyebrow">Estimated total</p><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Ontario HST (13%)</span><b>{money(tax)}</b></div><div className="cart-total"><span>Total</span><strong>{money(total)}</strong></div>
      <button disabled>Checkout coming soon</button>
      <p>Online ordering is disabled while the store completes regulatory and payment-provider approval. Adding products does not reserve them.</p>
      <Link href="/#catalogue">Continue shopping</Link>
    </aside>
  </div>;
}
