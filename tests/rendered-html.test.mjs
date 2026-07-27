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
  assert.match(storefront, /defaultArrivalBanners/);
  assert.match(storefront, /\/banners\/envi-apex-new-arrivals\.webp/);
  assert.match(storefront, /\/banners\/flavour-beast-60ml\.webp/);
  assert.match(storefront, /\/banners\/sour-gushin-60ml\.webp/);
  assert.match(storefront, /\/brand\/vape-mart-logo\.png/);
  assert.match(storefront, /priceRanges/);
  assert.match(storefront, /Filter by price/);
  assert.doesNotMatch(storefront, /promo-band/);
  assert.match(storefront, /5500/);
});

test("provides a non-transactional cart with Ontario HST and no checkout", async () => {
  const [cart, storefront] = await Promise.all([
    readFile(new URL("app/cart/cart-client.tsx", root), "utf8"),
    readFile(new URL("app/storefront.tsx", root), "utf8"),
  ]);
  assert.match(storefront, /Add to cart/);
  assert.match(storefront, /href="\/cart"/);
  assert.match(cart, /subtotal\*0\.13/);
  assert.match(cart, /Checkout coming soon/);
  assert.doesNotMatch(cart, /paymentIntent|checkoutSession|Place order/);
});

test("admin product controls persist through protected APIs", async () => {
  const [dashboard, productApi, productDetailApi, productImageApi] = await Promise.all([
    readFile(new URL("app/admin/dashboard.tsx", root), "utf8"),
    readFile(new URL("app/api/admin/products/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/products/[id]/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/products/[id]/image/route.ts", root), "utf8"),
  ]);
  assert.match(dashboard, /Save product/);
  assert.match(productApi, /authorizeAdmin/);
  assert.match(productDetailApi, /export async function PATCH/);
  assert.match(productDetailApi, /export async function DELETE/);
  assert.match(dashboard, /Change image/);
  assert.match(dashboard, /compressProductImage/);
  assert.match(productImageApi, /manual_image=1/);
  assert.match(productImageApi, /getStorage\(\)\.put/);
  assert.doesNotMatch(dashboard, /Taylor M\.|taylor@example\.com/);
});

test("database overlay keeps the complete catalogue without a heavy startup seed", async () => {
  const catalogue = await readFile(new URL("db/catalog.ts", root), "utf8");
  assert.match(catalogue, /for\(const product of importedProducts\)/);
  assert.match(catalogue, /databaseByUpc/);
  assert.match(catalogue, /product_deletions/);
  assert.doesNotMatch(catalogue, /INSERT OR IGNORE INTO products/);
});

test("admin manages up to six owned hero banners with defaults as fallback", async () => {
  const [storefront,bannerApi,dashboard] = await Promise.all([
    readFile(new URL("app/storefront.tsx", root), "utf8"),
    readFile(new URL("app/api/admin/banners/route.ts", root), "utf8"),
    readFile(new URL("app/admin/dashboard.tsx", root), "utf8"),
  ]);
  assert.match(storefront, /defaultArrivalBanners/);
  assert.match(storefront, /banners\.length\?banners:defaultArrivalBanners/);
  assert.match(bannerApi, /maximum of six hero banners/i);
  assert.match(dashboard, /Hero banners/);
  assert.match(dashboard, /compressHeroBanner/);
  assert.match(dashboard, /800_000/);
});

test("Excel imports automatically match approved product images", async () => {
  const [importApi,assets] = await Promise.all([
    readFile(new URL("app/api/admin/import/route.ts", root), "utf8"),
    readFile(new URL("db/assets.ts", root), "utf8"),
  ]);
  assert.match(importApi, /findAutomaticImage/);
  assert.match(assets, /digits\.includes\(upc\)/);
  assert.match(assets, /best\.score>=0\.72/);
  assert.match(assets, /uploaded-library/);
  assert.match(importApi, /imagesMatched/);
  assert.match(importApi, /imagesUnmatched/);
  assert.match(importApi, /item name/);
  assert.match(importApi, /department name/);
  assert.match(importApi, /category name/);
  assert.match(importApi, /sub category name/);
  assert.match(importApi, /skippedRows/);
  assert.match(importApi, /No RetailzPOS product table was found/);
  assert.doesNotMatch((await readFile(new URL("app/admin/dashboard.tsx", root), "utf8")), /tab==="Images"/);
});
