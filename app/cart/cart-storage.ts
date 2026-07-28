"use client";

import type { Product } from "../data";

export type CartItem = {
  id:string;
  slug:string;
  name:string;
  price:number;
  image?:string;
  quantity:number;
};

const key = "vapemart-cart-v1";

export function readCart():CartItem[] {
  if(typeof window==="undefined") return [];
  try { return JSON.parse(localStorage.getItem(key)||"[]"); } catch { return []; }
}

export function writeCart(items:CartItem[]) {
  localStorage.setItem(key,JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("vapemart-cart",{detail:items}));
}

export function selectedQuantity(items=readCart()) {
  return items.reduce((total,item)=>total+item.quantity,0);
}

export function addToList(product:Product) {
  const items=readCart();
  const found=items.find(item=>item.id===product.id);
  if(found) found.quantity=Math.min(99,found.quantity+1);
  else items.push({id:product.id,slug:product.slug,name:product.name,price:product.promoPrice||product.price,image:product.image,quantity:1});
  writeCart(items);
}

export const addToCart=addToList;
