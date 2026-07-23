import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "scripts/product-images.flavour-beast-50k.json"), "utf8"));
const imageDir = path.join(root, "public/products/flavour-beast-50k");
fs.mkdirSync(imageDir, { recursive: true });

if (process.argv.includes("--curl-config")) {
  const config = manifest.map(([slug, filename]) => [
    `url = "https://vapemanejuice.com/cdn/shop/files/${filename}"`,
    `output = "${path.join(imageDir, `${slug}.webp`)}"`,
  ].join("\n")).join("\n");
  fs.writeFileSync("/private/tmp/vape-images.curl", config);
  console.log(`Prepared ${manifest.length} exact-match image downloads.`);
  process.exit(0);
}

const productFile = path.join(root, "app/products.generated.ts");
const source = fs.readFileSync(productFile, "utf8");
const start = source.indexOf("= [") + 2;
const products = JSON.parse(source.slice(start, source.lastIndexOf("]") + 1));
const imageBySlug = new Map(manifest.map(([slug]) => [slug, `/products/flavour-beast-50k/${slug}.webp`]));

let updated = 0;
for (const product of products) {
  const image = imageBySlug.get(product.slug);
  if (!image) continue;
  product.image = image;
  updated += 1;
}

fs.writeFileSync(productFile, `import type { Product } from "./data";\n\nexport const importedProducts: Product[] = ${JSON.stringify(products, null, 2)};\n`);
console.log(`Attached ${updated} locally stored product images.`);
