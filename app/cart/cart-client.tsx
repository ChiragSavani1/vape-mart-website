"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { calculateCartTotals, readCart, writeCart, type CartItem } from "./cart-storage";
import { Inquiry } from "../storefront";

const money=(value:number)=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(value);

export function CartClient(){
  const [items,setItems]=useState<CartItem[]>([]);
  const [availability,setAvailability]=useState<CartItem|null>(null);
  useEffect(()=>setItems(readCart()),[]);
  const {subtotal,tax,total}=useMemo(()=>calculateCartTotals(items),[items]);
  function update(id:string,quantity:number){
    const next=items.flatMap(item=>item.id===id?(quantity>0?[{...item,quantity:Math.min(99,quantity)}]:[]):[item]);
    setItems(next);writeCart(next);
  }
  if(!items.length)return <div className="cart-empty"><span>0</span><h1>Your cart is empty</h1><p>Add products here, then ask our Barrie store to confirm availability.</p><Link className="primary" href="/#catalogue">Browse products</Link></div>;
  return <><div className="cart-layout">
    <section className="cart-items"><p className="eyebrow">Your selection</p><h1>Cart</h1>
      <p className="muted">Review your saved products and open any item to send an in-store availability request.</p>
      {items.map(item=><article className="cart-row" key={item.id}>
        <div className="cart-thumb">{item.image?<img src={item.image} alt="" loading="lazy" decoding="async"/>:<span>VM</span>}</div>
        <div><Link href={`/products/${item.slug}`}><b>{item.name}</b></Link><small>{money(item.price)} each</small><button className="cart-availability-link" onClick={()=>setAvailability(item)}>Check availability</button></div>
        <div className="quantity"><button onClick={()=>update(item.id,item.quantity-1)} aria-label={`Decrease ${item.name}`}>−</button><span>{item.quantity}</span><button onClick={()=>update(item.id,item.quantity+1)} aria-label={`Increase ${item.name}`}>+</button></div>
        <strong>{money(item.price*item.quantity)}</strong>
        <button className="remove" onClick={()=>update(item.id,0)}>Remove</button>
      </article>)}
    </section>
    <aside className="cart-summary"><p className="eyebrow">Price summary</p><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Ontario HST (13%)</span><b>{money(tax)}</b></div><div className="cart-total"><span>Estimated total</span><strong>{money(total)}</strong></div>
      <button className="cart-primary-action" onClick={()=>setAvailability(items[0])}>Check availability</button>
      <p>Availability and current price are confirmed by the store. Your cart is an inquiry aid and does not reserve products.</p>
      <Link href="/#catalogue">Continue browsing</Link>
    </aside>
  </div>{availability&&<Inquiry product={availability} initialQuantity={availability.quantity} close={()=>setAvailability(null)}/>}</>;
}
