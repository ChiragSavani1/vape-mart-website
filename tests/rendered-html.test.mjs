import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses the imported RetailzPOS catalogue without Hardware products", async () => {
  const generated = await readFile(new URL("app/products.generated.ts", root), "utf8");
  const products = JSON.parse(generated.slice(generated.indexOf("= [") + 2, generated.lastIndexOf("]") + 1));
  assert.equal(products.length, 903);
  assert.equal(products.some(product => product.category.toLowerCase().includes("hardware")), false);
  assert.equal(new Set(products.map(product => product.upc)).size, products.length);
  assert.equal(products.some(product => "cost" in product), false);
  assert.equal(products.find(product=>product.upc==="691584126875")?.image,"/products/catalog/stlth-titan-max-juicy-peach-50k-26875.webp");
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
  assert.match(storefront, /\/brand\/vape-mart-logo-small\.webp/);
  assert.match(storefront, /priceRanges/);
  assert.match(storefront, /Filter by price/);
  assert.doesNotMatch(storefront, /promo-band/);
  assert.match(storefront, /5500/);
  assert.doesNotMatch(storefront, /VapeDimension|vape-device|Vape Mart in motion/);
  assert.match(storefront, /MotionLayer/);
  assert.match(storefront, /data-reveal/);
  assert.match(storefront, /categoryImageFor/);
  assert.match(storefront, /closepod/);
  assert.match(storefront, /eliquid/);
});

test("provides a persistent availability list with Ontario HST", async () => {
  const [cart, storage, storefront] = await Promise.all([
    readFile(new URL("app/cart/cart-client.tsx", root), "utf8"),
    readFile(new URL("app/cart/cart-storage.ts", root), "utf8"),
    readFile(new URL("app/storefront.tsx", root), "utf8"),
  ]);
  assert.match(storefront, /Add to List/);
  assert.match(storefront, /href="\/cart"/);
  assert.match(storefront, /selectedQuantity/);
  assert.match(storefront, /vapemart-cart/);
  assert.match(storage, /localStorage/);
  assert.match(cart, /subtotal\*0\.13/);
  assert.match(cart, /My List/);
  assert.match(cart, /Check availability/);
  assert.doesNotMatch(cart, /paymentIntent|checkoutSession|Place order/);
  assert.doesNotMatch(cart, /checkout|payment unavailable|online ordering is disabled/i);
});

test("product pages use a dark detail layout with list and availability actions", async () => {
  const [page, detail, css] = await Promise.all([
    readFile(new URL("app/products/[slug]/page.tsx", root), "utf8"),
    readFile(new URL("app/products/[slug]/product-detail-client.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(page, /product-detail-theme/);
  assert.doesNotMatch(page, /ProductCard/);
  assert.match(detail, /Add to List/);
  assert.match(detail, /Check availability/);
  assert.match(detail, /addToList/);
  assert.match(detail, /<Inquiry/);
  assert.doesNotMatch(detail, /checkout|payment remains|catalogue cart/i);
  assert.match(css, /Dark editorial product-detail experience/);
  assert.match(css, /\.product-detail-page/);
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
  assert.match(productImageApi, /putObject\(/);
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

test("admin can run a controlled missing-image search", async () => {
  const [dashboard, imageSearch] = await Promise.all([
    readFile(new URL("app/admin/dashboard.tsx", root), "utf8"),
    readFile(new URL("app/api/admin/image-search/route.ts", root), "utf8"),
  ]);
  assert.match(dashboard, /Find missing images/);
  assert.match(dashboard, /Searching 5 products/);
  assert.match(imageSearch, /authorizeAdmin/);
  assert.match(imageSearch, /duckduckgo\.com/);
  assert.match(imageSearch, /trustedOfficialHosts/);
  assert.match(imageSearch, /confidence >= \.72/);
  assert.match(imageSearch, /putObject\(/);
  assert.match(imageSearch, /image_matches/);
  assert.match(imageSearch, /NoMatch/);
});

test("mobile catalogue defers and caches product imagery", async () => {
  const [storefront, assetRoute, css] = await Promise.all([
    readFile(new URL("app/storefront.tsx", root), "utf8"),
    readFile(new URL("app/api/assets/[...key]/route.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(storefront, /loading=\{priority \? "eager" : "lazy"\}/);
  assert.match(storefront, /decoding="async"/);
  assert.match(storefront, /fetchPriority/);
  assert.match(storefront, /useState\(12\)/);
  assert.match(storefront, /vape-mart-logo-small\.webp/);
  assert.match(assetRoute, /max-age=31536000, immutable/);
  assert.match(css, /content-visibility:auto/);
  assert.match(css, /repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /-webkit-line-clamp:2/);
  assert.match(storefront, /Filter &amp; Sort/);
  assert.match(storefront, /No products found/);
  assert.match(storefront, /Clear search &amp; filters/);
});

test("shared customer header keeps search, list quantity, and navigation accessible", async () => {
  const [storefront,contact,legal,cartPage,productPage,css] = await Promise.all([
    readFile(new URL("app/storefront.tsx", root), "utf8"),
    readFile(new URL("app/contact/page.tsx", root), "utf8"),
    readFile(new URL("app/legal/[page]/page.tsx", root), "utf8"),
    readFile(new URL("app/cart/page.tsx", root), "utf8"),
    readFile(new URL("app/products/[slug]/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(storefront, /aria-label="Search products"/);
  assert.match(storefront, /action="\/#catalogue"/);
  assert.match(storefront, /My List, \$\{quantity\}/);
  assert.match(storefront, /back-to-top/);
  assert.match(storefront, /<AgeGate \/>/);
  for(const page of [contact,legal,cartPage,productPage])assert.match(page, /<Header/);
  assert.match(css, /\.site-header/);
  assert.match(css, /position:sticky/);
  assert.doesNotMatch(`${storefront}\n${cartPage}`, /checkout disabled|payment unavailable|cart preview|\bMVP\b|email notification is still being configured/i);
});

test("availability requests remain saved and report email delivery state", async () => {
  const [publicApi, adminApi, email, storefront, dashboard] = await Promise.all([
    readFile(new URL("app/api/inquiries/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/inquiries/[id]/route.ts", root), "utf8"),
    readFile(new URL("db/email.ts", root), "utf8"),
    readFile(new URL("app/storefront.tsx", root), "utf8"),
    readFile(new URL("app/admin/dashboard.tsx", root), "utf8"),
  ]);
  assert.match(publicApi, /notification: notification\.status/);
  assert.match(publicApi, /AVAILABILITY_TO/);
  assert.match(email, /not_configured/);
  assert.match(email, /transactional_email_rejected/);
  assert.match(adminApi, /manual_phone_follow_up/);
  assert.match(adminApi, /delivery/);
  assert.match(storefront, /Our store team will check this product/i);
  assert.match(dashboard, /Status saved and the customer email was sent/);
});
