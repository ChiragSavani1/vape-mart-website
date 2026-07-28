import assert from "node:assert/strict";
import test from "node:test";

const values=new Map();
globalThis.localStorage={
  getItem:key=>values.get(key)??null,
  setItem:(key,value)=>values.set(key,String(value)),
  removeItem:key=>values.delete(key),
  clear:()=>values.clear(),
};
globalThis.window=new EventTarget();

const {addToCart,calculateCartTotals,readCart,selectedQuantity,writeCart}=await import("../app/cart/cart-storage.ts");

test("selected quantities persist and notify every mounted header",()=>{
  let notifications=0;
  window.addEventListener("vapemart-cart",()=>notifications++);
  const product={id:"test-product",slug:"test-product",name:"Test Product",price:20,image:"/test.webp"};
  addToCart(product);
  addToCart(product);
  assert.equal(selectedQuantity(),2);
  assert.deepEqual(readCart(),[{id:"test-product",slug:"test-product",name:"Test Product",price:20,image:"/test.webp",quantity:2}]);
  const pageReloadSelection=readCart();
  assert.equal(pageReloadSelection[0].quantity,2);
  writeCart([{...pageReloadSelection[0],quantity:3}]);
  assert.equal(selectedQuantity(),3);
  assert.deepEqual(calculateCartTotals(readCart()),{subtotal:60,tax:7.8,total:67.8});
  writeCart([]);
  assert.deepEqual(calculateCartTotals(readCart()),{subtotal:0,tax:0,total:0});
  assert.equal(selectedQuantity(),0);
  assert.equal(notifications,4);
});
