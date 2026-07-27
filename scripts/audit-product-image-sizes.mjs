import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cacheDir = process.env.CATALOGUE_CACHE_DIR || "/private/tmp";
const productFile = path.join(root, "app/products.generated.ts");
const productSource = fs.readFileSync(productFile, "utf8");
const products = JSON.parse(
  productSource.slice(productSource.indexOf("= [") + 2, productSource.lastIndexOf("]") + 1),
);

function normalize(value) {
  return value.toLowerCase().normalize("NFKD")
    .replace(/flavou?rbeast/g, "flavour beast")
    .replace(/\bfb\b/g, "flavour beast")
    .replace(/\bbluerazz\b|\bblue razz\b/g, "blue raspberry")
    .replace(/\bflipin\b/g, "flippin")
    .replace(/\bwid white\b/g, "wild white")
    .replace(/\bwatermelona\b|\bwatermeon\b/g, "watermelon")
    .replace(/\bdragon fruit\b/g, "dragonfruit")
    .replace(/\bpassion fruit\b/g, "passionfruit")
    .replace(/\bs\.(?=\s)/g, "sour")
    .replace(/\bice\b/g, "iced")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ignored = new Set([
  "flavour", "beast", "fb", "60", "60ml", "ml", "salt", "juice", "e", "liquid",
  "eliquid", "iced", "by", "nic", "nicotine", "mg", "20mg", "series",
]);

function flavourTokens(value) {
  return [...new Set(normalize(value).split(" ").filter(token =>
    token && !ignored.has(token) && !/^\d+$/.test(token) && !/^\d+mg$/.test(token)
  ))];
}

const listings = [];
for (const file of fs.readdirSync(cacheDir).filter(file => /-products-\d+\.json$/.test(file))) {
  const source = file.match(/^(.*?)-products/)?.[1] || file;
  const data = JSON.parse(fs.readFileSync(path.join(cacheDir, file), "utf8"));
  for (const product of data.products || []) {
    if (product.images?.[0]?.src) {
      listings.push({ source, title: product.title, image: product.images[0].src });
    }
    for (const variant of product.variants || []) {
      if (!variant.featured_image?.src) continue;
      listings.push({
        source,
        title: `${product.title} ${variant.title}`,
        image: variant.featured_image.src,
      });
    }
  }
}

const sourcePriority = new Map([
  ["vipvape-ca", 50],
  ["qualityvapes-ca", 45],
  ["www-vapebest-ca", 40],
  ["bayvape-ca", 38],
  ["vapecloud-ca", 35],
  ["vapeman", 32],
  ["vapemeet", 30],
  ["shopkockydog-ca", 28],
]);

function scoreListing(listing, tokens) {
  const title = normalize(listing.title);
  const image = normalize(listing.image);
  const imageCoverage = tokens.filter(token => image.includes(token)).length;
  return (sourcePriority.get(listing.source) || 0)
    + imageCoverage * 8
    + (image.includes("btl") ? 6 : 0)
    + (title.includes("20mg") ? 4 : 0)
    - (title.includes("freebase") ? 12 : 0);
}

function findFlavourBeast60(product) {
  const tokens = flavourTokens(product.name);
  return listings
    .filter(listing => {
      const title = normalize(listing.title);
      if (!title.includes("flavour beast") || !/\b60\s*ml\b/.test(title)) return false;
      if (/\bpod\b|\blevel x\b|\bdisposable\b/.test(title)) return false;
      const listingTokens = flavourTokens(title);
      return tokens.every(token => listingTokens.includes(token));
    })
    .sort((a, b) => scoreListing(b, tokens) - scoreListing(a, tokens))[0];
}

const apexOverrides = new Map([
  ["envi-apex-2500-intense-mint-98958", "https://cdn.shopify.com/s/files/1/0366/3563/9852/files/Intense_Mint_20mg_-_Family.png?v=1771954032"],
  ["envi-apex-2500-blue-razz-98897", "https://cdn.shopify.com/s/files/1/0366/3563/9852/files/Blue_Razz_20mg_-_Family.png?v=1771954032"],
  ["envi-apex-2500-pink-lemon-99047", "https://cdn.shopify.com/s/files/1/0366/3563/9852/files/Pink_Lemon_20mg_-_Family.png?v=1771954032"],
  ["envi-apex-2500-mango-peach-watermelon-99016", "https://cdn.shopify.com/s/files/1/0948/6077/1625/files/MangoPeachWatermelon_4be4fcef-626e-4d50-99fc-b057df9fde70.jpg?v=1765940036"],
  ["envi-apex-2500-banana-iced-98880", "https://mistervapor.ca/cdn/shop/products/enviapexbananaice.jpg?v=1631555348"],
  ["envi-apex-2500-mango-iced-99009", "https://infinitevapes.com/cdn/shop/products/envi-apex-mango-iced_3f4324ee-1eec-4afd-9914-34b27c2d2541.jpg?v=1695002486&width=1946"],
  ["envi-apex-2500-strawberry-iced-99078", "https://cdn.shopify.com/s/files/1/0397/9932/4821/files/envi_apex-2022-render-fam_20mg_strawberryiced.webp?v=1767467278"],
  ["envi-apex-2500-lush-iced-98989", "https://cdn.shopify.com/s/files/1/0263/5887/4178/products/104FA985-A6BB-46E6-AC21-3E77EEFFBCF8.jpg?v=1636127186"],
  ["envi-apex-2500-lychee-watermelon-strawberry-iced-98972", "https://cdn.shopify.com/s/files/1/1092/6888/files/Lychee-Watermelon-Strawberry-Iced-Envi-Apex-Disposable-Vape-Canada-Vape360.jpg?v=1741435437"],
  ["envi-apex-2500-white-grape-iced-99085", "https://cdn.shopify.com/s/files/1/0676/0765/8708/products/envi-apex-white-grape-iced_be82f143-f04b-46cd-8f67-17fcca7d13e1.jpg?v=1741986795"],
  ["envi-apex-2500-peach-berry-99030", "https://cdn.shopify.com/s/files/1/0948/6077/1625/files/PeachBerry_066543a4-e593-4a05-ad12-e66177a8b991.jpg?v=1765940041"],
  ["envi-apex-2500-green-apple-98934", "https://cdn.shopify.com/s/files/1/0948/6077/1625/files/GreenApple_38f37d78-a9dd-43d4-aea3-a32e74401c66.jpg?v=1765940032"],
  ["envi-apex-intense-mint-60849", "https://cdn.shopify.com/s/files/1/0823/5817/3921/files/imgi_2_imgi_24_envi-apex-intense-mint-2500-puffs-20mg-1.jpg?v=1776979863"],
]);

const corrections = [];
for (const product of products) {
  const apexImage = apexOverrides.get(product.slug);
  if (apexImage) {
    corrections.push({
      slug: product.slug,
      productName: product.name,
      reason: "Exact Envi Apex flavour and model",
      expectedVolume: "6 mL",
      sourceUrl: apexImage,
      image: `/products/catalog/${product.slug}.webp`,
    });
    continue;
  }

  if (
    product.category === "E-Liquids"
    && product.price > 50
    && /\bfb\b|flavou?r\s*beast/i.test(product.name)
  ) {
    const listing = findFlavourBeast60(product);
    if (!listing) continue;
    corrections.push({
      slug: product.slug,
      productName: product.name,
      reason: "Price-validated 60 mL e-liquid image",
      expectedVolume: "60 mL",
      sourceTitle: listing.title,
      source: listing.source,
      sourceUrl: listing.image,
      image: `/products/catalog/${product.slug}.webp`,
    });
  }
}

corrections.push({
  slug: "lemon-drop-boost-blue-razz-33079",
  productName: "Lemon drop boost blue razz",
  reason: "Price-validated 30 mL e-liquid image",
  expectedVolume: "30 mL",
  sourceTitle: "Blue Raspberry by Lemon Drop Boost Salt — 30mL",
  source: "qualityvapes-ca",
  sourceUrl: "https://cdn.shopify.com/s/files/1/0397/9932/4821/files/BLUE-RASPBERRY-BY-LEMON-DROP-BOOST-SALT.jpg?v=1752120477",
  image: "/products/catalog/lemon-drop-boost-blue-razz-33079.webp",
});

const manifestFile = path.join(root, "scripts/product-image-corrections.json");
fs.writeFileSync(manifestFile, `${JSON.stringify(corrections, null, 2)}\n`);

if (process.argv.includes("--curl-config")) {
  const imageDir = path.join(root, "public/products/catalog");
  fs.mkdirSync(imageDir, { recursive: true });
  const config = corrections.map(correction => [
    `url = "${correction.sourceUrl}"`,
    `output = "${path.join(imageDir, `${correction.slug}.source`)}"`,
  ].join("\n")).join("\n");
  fs.writeFileSync("/private/tmp/vape-image-corrections.curl", config);
}

if (process.argv.includes("--apply")) {
  const imageBySlug = new Map(corrections.map(correction => [correction.slug, correction.image]));
  for (const product of products) {
    if (imageBySlug.has(product.slug)) product.image = imageBySlug.get(product.slug);
  }
  fs.writeFileSync(
    productFile,
    `import type { Product } from "./data";\n\nexport const importedProducts: Product[] = ${JSON.stringify(products, null, 2)};\n`,
  );
}

console.log(`Prepared ${corrections.length} validated product image corrections.`);
