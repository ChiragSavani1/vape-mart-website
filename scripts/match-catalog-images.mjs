import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const minimumConfidence = Number(process.env.IMAGE_MATCH_CONFIDENCE || "0.80");
const productFile = path.join(root, "app/products.generated.ts");
const source = fs.readFileSync(productFile, "utf8");
const products = JSON.parse(source.slice(source.indexOf("= [") + 2, source.lastIndexOf("]") + 1));

const catalogues = [];
for (const sourceName of [
  "vapemeet",
  "vapeman",
  "vipvape-ca",
  "bayvape-ca",
  "shopkockydog-ca",
  "www-vape360-ca",
  "www-dundasvapes-ca",
  "qualityvapes-ca",
  "www-vapebest-ca",
  "vapecloud-ca",
]) {
  for (let page = 1; page <= 12; page += 1) {
    const file = `/private/tmp/${sourceName}-products-${page}.json`;
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const product of data.products) {
      if (product.images?.[0]?.src) catalogues.push({ ...product, sourceName });
      for (const variant of product.variants || []) {
        if (!variant.featured_image?.src) continue;
        catalogues.push({
          ...product,
          title: `${product.title} ${variant.title}`,
          images: [{ src: variant.featured_image.src }],
          sourceName,
        });
      }
    }
  }
}

function normalize(value) {
  return value.toLowerCase().normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/flavourbeast/g, "flavour beast")
    .replace(/geekbar/g, "geek bar")
    .replace(/elfbar/g, "elf bar")
    .replace(/drip[’']?n|dripin/g, "drip n")
    .replace(/\bfb\b/g, "flavour beast")
    .replace(/\bstrbry\b/g, "strawberry")
    .replace(/\brspbry\b/g, "raspberry")
    .replace(/\bchry\b/g, "cherry")
    .replace(/\bblueraspberry\b/g, "blue raspberry")
    .replace(/\bnector\b/g, "nectar")
    .replace(/\bhawaiian fruit nectar\b/g, "hawaiian fruit punch")
    .replace(/\bstarwberry\b/g, "strawberry")
    .replace(/\bwatermeon\b/g, "watermelon")
    .replace(/\bleave x\b/g, "level x")
    .replace(/\bpassionfruit\b/g, "passion fruit")
    .replace(/\biced\b/g, "ice")
    .replace(/\bbluerazz\b/g, "blue razz")
    .replace(/\bblue razz\b/g, "blue raspberry")
    .replace(/\bsakuragrape\b/g, "sakura grape")
    .replace(/\bflipin\b/g, "flippin")
    .replace(/\bwid white\b/g, "wild white")
    .replace(/\bwatermelona\b/g, "watermelon")
    .replace(/\bnf\b|\b0 nic\b/g, "0mg")
    .replace(/\btm\b/g, "twelve monkeys")
    .replace(/\bfruity g\b/g, "fruity gushin")
    .replace(/\bstraw banana\b/g, "strawberry banana")
    .replace(/\bvanana\b/g, "banana")
    .replace(/\bmangabyes\b/g, "mangabeys")
    .replace(/\btropica\b/g, "tropika")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const stopWords = new Set("vape vaping disposable device devices pod pods eliquid liquid juice salt salted nicotine ont ontario pack kit prefilled puffs up to the by and of flavour flavor".split(" "));
const flavourWords = new Set("apple banana berry berries blueberry cherry coconut coffee dragonfruit grape grapefruit guava kiwi lemon lime lychee mango melon mint mocha orange passion peach pineapple pomegranate pom raspberry strawberry tobacco watermelon".split(" "));
function tokens(value) {
  return [...new Set(normalize(value).split(" ").filter(token =>
    token && !stopWords.has(token) && !/^\d+(mg|ml)?$/.test(token)
  ))];
}

const brandRules = [
  [/\btwelve monkeys\b/, /\btwelve monkeys\b/],
  [/\bflavour beast\b/, /\bflavour beast\b/],
  [/\bstlth\b/, /\bstlth\b/],
  [/\bgeek bar\b/, /\bgeek bar\b/],
  [/\belf bar\b/, /\belf bar\b/],
  [/\blemon drop\b/, /\blemon drop\b/],
  [/\bdrip n\b/, /\bdrip n\b/],
  [/\ballo\b/, /\ballo\b/],
  [/\bvice\b/, /\bvice\b/],
  [/\bkraze\b/, /\bkraze\b/],
  [/\bnasha\b/, /\bnasha\b/],
  [/\benvi\b/, /\benvi\b/],
  [/\blost mary\b/, /\blost mary\b/],
  [/\borbito\b/, /\borbito\b/],
  [/\boxbar\b/, /\boxbar\b/],
  [/\bzpods?\b/, /\bz ?pods?\b/],
  [/\bicon bar\b/, /\bicon bar\b/],
  [/\bnaked\b|\bnkd100\b/, /\bnaked\b|\bnkd100\b/],
];

const modelRules = [
  [/\btwelve monkeys\b|\bflavour beast tm\b/, /\btwelve monkeys\b/],
  [/\bbeast mode max 3\b|\bmax 3\b/, /\bbeast mode max 3\b|\bmax 3\b/],
  [/\bbeast mode max 2\b|\bbeast mode max 50k\b|\bfb 50k\b/, /\bbeast mode max 2\b/],
  [/\balpha\b/, /\balpha\b/],
  [/\bpulse x\b/, /\bpulse x\b/],
  [/\bstlth x geek bar\b/, /\bstlth x geek bar\b/],
  [/\btitan max\b/, /\btitan max\b/],
  [/\bvice loop max\b/, /\bvice loop max\b/],
  [/\bloop max\b/, /\bloop max\b/],
  [/\bloop 25k\b|\bloop 2 25k\b/, /\bloop 25k\b|\bloop 2\b/],
  [/\b8k pro\b/, /\b8k pro\b|\bstlth 8k\b/],
  [/\beco box\b/, /\beco box\b/],
  [/\beco xl\b/, /\beco xl\b/],
  [/\beco mini\b/, /\beco mini\b/],
  [/\bstlth eco\b/, /\bstlth eco\b(?! (box|xl|mini))/],
  [/\bstlth switch\b/, /\bstlth switch\b/],
  [/\ballo 2500\b/, /\ballo (ultra )?2500\b/],
  [/\ballo 1600\b/, /\ballo (ultra )?1600\b/],
  [/\bkraze luna\b/, /\bkraze luna\b/],
  [/\bnasha 40k\b/, /\bnasha\b.*\b40k\b|\b40k\b.*\bnasha\b/],
  [/\benvi apex\b/, /\benvi apex\b|\bdrip n by envi 8ml\b|\benvi drip n 16k\b/],
  [/\blost mary 50k\b/, /\blost mary mt50k\b/],
  [/\belf bar 70k\b/, /\belf bar\b.*(?:fs|moon ?night)?70k\b/],
  [/\belf bar 20k\b/, /\belf bar (gh)?20k\b/],
  [/\belf bar 10k\b/, /\belf bar (bc)?10k\b/],
  [/\bdrip n 100k\b|\bdaily 100k\b/, /\bdrip n daily\b|\bdaily 100k\b/],
  [/\bdrip n 70k\b|\bdripin 26ml\b/, /\bdrip n 26ml\b|\bdrip n 70k\b/],
  [/\bdrip n 28k\b/, /\bdrip n (evo )?28k\b/],
  [/\bdrip n 16k\b|\bdripin 8ml\b/, /\bdrip n 8ml\b|\bdrip n 16k\b/],
  [/\blevel x\b.*\bg2 ultra\b|\bg2 ultra\b/, /\blevel x\b.*\bg2 ultra\b|\bg2 ultra\b/],
  [/\blevel x\b/, /\blevel x\b/],
  [/\blemon drop boost\b/, /\blemon drop boost\b/],
  [/\blemon drop\b.*\bice\b/, /\blemon drop\b.*\bice\b/],
  [/\blemon drop\b.*\bfree base\b|\blemon drop\b.*\bfreebase\b/, /\blemon drop\b.*\bfree ?base\b/],
  [/\bvice box 2\b/, /\bvice box 2\b/],
  [/\bflavour beast pods?\b/, /\bstlth compatible flavour beast\b|\bflavour beast pods?\b/],
  [/\bflavour beast\b.*\bpods?\b/, /\bflavour beast\b.*\bpods?\b/],
  [/\bstlth pods?\b/, /\bstlth\b.*\bpods?\b/],
];

function matchScore(product, listing) {
  const target = normalize(`${product.brand} ${product.flavour} ${product.name}`);
  const title = normalize(listing.title);
  if (/\blemon drop\b/.test(target) && !/\bice\b|\biced\b/.test(target) && /\blemon drop ice\b/.test(title)) return 0;
  if (/\blemon drop\b/.test(target) && !/\bboost\b/.test(target) && /\bboost\b/.test(title)) return 0;
  if (/\btwelve monkeys\b/.test(target) && /\b(3|6)mg\b/.test(target) && /\bsalt\b/.test(title)) return 0;
  if (!/\bkiwi\b/.test(target) && /\bkiwi\b/.test(title)) return 0;
  const targetStrength = target.match(/\b(\d+)\s*mg\b/)?.[1];
  const titleStrength = title.match(/\b(\d+)\s*mg\b/)?.[1];
  if (targetStrength && titleStrength && targetStrength !== titleStrength) return 0;
  if (!targetStrength && product.category === "Disposables" && titleStrength === "10") return 0;
  const targetVolume = target.match(/\b(\d+)\s*ml\b/)?.[1];
  const titleVolume = title.match(/\b(\d+)\s*ml\b/)?.[1];
  if (targetVolume && titleVolume && targetVolume !== titleVolume) return 0;
  if (
    product.category === "E-Liquids"
    && !/\b(e liquid|juice|salt|freebase|free base)\b/.test(title)
    && !(/\btwelve monkeys\b/.test(target) && /\btwelve monkeys\b/.test(title))
  ) return 0;
  if ((product.category === "Pods" || product.category === "Closed Pod Systems") && !/\bpod\b|\bpods\b|\bzpods\b/.test(title)) return 0;
  const brandRule = brandRules.find(([targetPattern]) => targetPattern.test(target));
  if (brandRule && !brandRule[1].test(title)) return 0;
  const modelRule = modelRules.find(([targetPattern]) => targetPattern.test(target));
  if (modelRule && !modelRule[1].test(title)) return 0;

  const queryTokens = tokens(target);
  const titleTokens = tokens(title);
  const nameTokens = tokens(product.name);
  const familySource = normalize(product.flavour) === normalize(product.name)
    ? product.brand
    : `${product.brand} ${product.flavour}`;
  const familyTokens = new Set(tokens(familySource));
  const significantTokens = nameTokens.filter(token => !familyTokens.has(token));
  if (significantTokens.length && !significantTokens.every(token => titleTokens.includes(token))) return 0;
  if (titleTokens.some(token => flavourWords.has(token) && !queryTokens.includes(token))) return 0;
  if (modelRule && significantTokens.length) {
    const extraTokens = titleTokens.filter(token => !queryTokens.includes(token)).length;
    return 0.99 - Math.min(extraTokens, 20) * 0.001;
  }
  const titleCoverage = titleTokens.filter(token => queryTokens.includes(token)).length / titleTokens.length;
  const nameCoverage = nameTokens.filter(token => titleTokens.includes(token)).length / nameTokens.length;
  const exactNameBonus = significantTokens.length && (brandRule || modelRule) ? 0.12 : 0;
  return Math.min(1, (titleCoverage * 0.58) + (nameCoverage * 0.42) + exactNameBonus);
}

const matches = [];
for (const product of products.filter(product => !product.image)) {
  let best;
  for (const listing of catalogues) {
    const score = matchScore(product, listing);
    if (!best || score > best.score) best = { listing, score };
  }
  if (process.env.DEBUG_PRODUCT && normalize(product.name).includes(normalize(process.env.DEBUG_PRODUCT))) {
    console.log("DEBUG", product.name, best?.score, best?.listing?.title);
  }
  if (!best || best.score < minimumConfidence) continue;
  matches.push({
    slug: product.slug,
    productName: product.name,
    sourceTitle: best.listing.title,
    source: best.listing.sourceName,
    sourceUrl: best.listing.images[0].src,
    confidence: Number(best.score.toFixed(3)),
    image: `/products/catalog/${product.slug}.webp`,
  });
}

const manifestFile = path.join(root, "scripts/product-image-manifest.json");
fs.writeFileSync(manifestFile, `${JSON.stringify(matches, null, 2)}\n`);

if (process.argv.includes("--curl-config")) {
  const imageDir = path.join(root, "public/products/catalog");
  fs.mkdirSync(imageDir, { recursive: true });
  const config = matches.map(match => [
    `url = "${match.sourceUrl}"`,
    `output = "${path.join(imageDir, `${match.slug}.source`)}"`,
  ].join("\n")).join("\n");
  fs.writeFileSync("/private/tmp/vape-catalog-images.curl", config);
}

if (process.argv.includes("--apply")) {
  const imageBySlug = new Map(matches.map(match => [match.slug, match.image]));
  for (const product of products) {
    if (!product.image && imageBySlug.has(product.slug)) product.image = imageBySlug.get(product.slug);
  }
  fs.writeFileSync(productFile, `import type { Product } from "./data";\n\nexport const importedProducts: Product[] = ${JSON.stringify(products, null, 2)};\n`);
}

console.log(`Prepared ${matches.length} high-confidence image matches.`);
