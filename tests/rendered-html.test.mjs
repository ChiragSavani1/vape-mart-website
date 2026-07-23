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

test("uses exact Envi Apex artwork and price-validated e-liquid bottle sizes", async () => {
  const [generated, corrections, storefront] = await Promise.all([
    readFile(new URL("app/products.generated.ts", root), "utf8"),
    readFile(new URL("scripts/product-image-corrections.json", root), "utf8"),
    readFile(new URL("app/storefront.tsx", root), "utf8"),
  ]);
  const products = JSON.parse(generated.slice(generated.indexOf("= [") + 2, generated.lastIndexOf("]") + 1));
  const audited = JSON.parse(corrections);
  const auditedBySlug = new Map(audited.map(item => [item.slug, item]));
  const apex = products.filter(product => /envi apex/i.test(product.name));
  const flavourBeast60 = products.filter(product =>
    product.category === "E-Liquids"
    && product.price > 50
    && /\bfb\b|flavou?r\s*beast/i.test(product.name)
  );

  assert.equal(apex.length, 13);
  assert.equal(apex.every(product => product.image && auditedBySlug.has(product.slug)), true);
  assert.equal(flavourBeast60.length, 30);
  assert.equal(flavourBeast60.every(product => auditedBySlug.get(product.slug)?.expectedVolume === "60 mL"), true);
  assert.equal(auditedBySlug.get("lemon-drop-boost-blue-razz-33079")?.expectedVolume, "30 mL");
  assert.match(storefront, /arrivalBanners/);
  assert.match(storefront, /\/banners\/pacific-kraze-giga\.webp/);
  assert.match(storefront, /\/banners\/pacific-flavour-beast-max2\.webp/);
  assert.match(storefront, /\/brand\/vape-mart-store-symbol\.webp/);
  assert.match(storefront, /priceRanges/);
  assert.match(storefront, /Filter by price/);
  assert.doesNotMatch(storefront, /promo-band/);
  assert.match(storefront, /5500/);
});
