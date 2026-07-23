import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses the imported RetailzPOS catalogue without Hardware products", async () => {
  const generated = await readFile(new URL("app/products.generated.ts", root), "utf8");
  const products = JSON.parse(generated.slice(generated.indexOf("= [") + 2, generated.lastIndexOf("]") + 1));
  assert.equal(products.length, 902);
  assert.equal(products.some(product => product.category.toLowerCase().includes("hardware")), false);
  assert.equal(new Set(products.map(product => product.upc)).size, products.length);
  assert.equal(products.some(product => "cost" in product), false);
});

test("uses the Barrie store details and monochrome theme", async () => {
  const [data, css] = await Promise.all([
    readFile(new URL("app/data.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(data, /307 Cundles Road East, Barrie, ON/);
  assert.match(data, /9:00 AM – 10:00 PM/);
  assert.match(data, /10:00 AM – 9:00 PM/);
  assert.match(css, /Monochrome Vape Mart theme/);
  assert.doesNotMatch(css.split("Monochrome Vape Mart theme").pop(), /#44766d|#cced47|#5c63e8/i);
});
