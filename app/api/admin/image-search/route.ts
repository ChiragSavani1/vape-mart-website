import { NextResponse } from "next/server";
import type { AdminProduct } from "../../../../db/catalog";
import { ensureProductSeed, loadProducts } from "../../../../db/catalog";
import { assetUrl, findAutomaticImage, normalizeAssetName } from "../../../../db/assets";
import { getStorage } from "../../../../db/runtime";
import { authorizeAdmin } from "../authorize";

type WebResult = { title?: string; image?: string; url?: string };
type Candidate = { title: string; image: string; page: string; confidence: number };

const trustedOfficialHosts = [
  "stlthvape.com",
  "flavourbeast.com",
  "twelvemonkeysvapor.com",
  "envi.com",
  "envi-vape.com",
  "geekbar.com",
  "uwell.com",
  "voopoo.com",
  "vaporesso.com",
];
const ignoredTokens = new Set([
  "vape", "vaping", "product", "products", "device", "disposable", "pod", "pods",
  "online", "shop", "store", "canada", "ontario", "buy", "new", "the", "with",
]);

function safePublicUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol) || host === "localhost" || host.endsWith(".local")) return null;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":")) return null;
    return url;
  } catch {
    return null;
  }
}

function trustedPage(value: string) {
  const url = safePublicUrl(value);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return host.endsWith(".ca") || trustedOfficialHosts.some(domain => host === domain || host.endsWith(`.${domain}`)) ? url : null;
}

function meaningfulTokens(value: string) {
  return normalizeAssetName(value).split(" ").filter(token => token.length > 2 && !ignoredTokens.has(token));
}

function scoreResult(product: AdminProduct, result: WebResult) {
  const page = result.url ? trustedPage(result.url) : null;
  const image = result.image ? safePublicUrl(result.image) : null;
  if (!page || !image || !result.title) return null;
  const productTokens = [...new Set(meaningfulTokens(`${product.brand} ${product.name} ${product.flavour}`))];
  const candidateTokens = new Set(meaningfulTokens(`${result.title} ${page.pathname}`));
  const brandTokens = meaningfulTokens(product.brand);
  if (brandTokens.length && !brandTokens.some(token => candidateTokens.has(token))) return null;
  const matched = productTokens.filter(token => candidateTokens.has(token)).length;
  const confidence = productTokens.length ? matched / productTokens.length : 0;
  return confidence >= .72 ? { title: result.title, image: image.href, page: page.href, confidence } : null;
}

async function searchWeb(product: AdminProduct): Promise<Candidate | null> {
  const query = [product.brand, product.name, product.flavour].filter(Boolean).join(" ");
  const headers = {
    "user-agent": "Mozilla/5.0 (compatible; VapeMartImageReview/1.0)",
    "accept-language": "en-CA,en;q=0.9",
  };
  const landing = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
    headers, cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!landing.ok) return null;
  const html = await landing.text();
  const vqd = html.match(/vqd=["']([^"']+)/)?.[1];
  if (!vqd) return null;
  const response = await fetch(`https://duckduckgo.com/i.js?l=ca-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,`, {
    headers: { ...headers, referer: landing.url }, cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { results?: WebResult[] };
  const candidates = (payload.results || [])
    .map(result => scoreResult(product, result))
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .sort((a, b) => b.confidence - a.confidence);
  return candidates[0] || null;
}

async function saveProductImage(product: AdminProduct, image: string, source: string, sourcePath: string, confidence: number) {
  const db = await ensureProductSeed();
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO products
    (id,upc,slug,name,brand,category,flavour,price,image_key,visible,featured,manual_image,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(upc) DO UPDATE SET image_key=excluded.image_key,manual_image=0,updated_at=excluded.updated_at`)
    .bind(product.id, product.upc, product.slug, product.name, product.brand, product.category, product.flavour,
      product.price, image, product.visible ? 1 : 0, product.featured ? 1 : 0, 0, now).run();
  await db.prepare("INSERT INTO image_matches (id,product_id,source,source_path,stored_key,confidence,reason,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), product.id, source, sourcePath, image, confidence,
      "Automatic match accepted only after source and product-name confidence checks.", "Approved", now).run();
}

async function downloadCandidate(product: AdminProduct, candidate: Candidate) {
  const response = await fetch(candidate.image, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; VapeMartImageReview/1.0)", accept: "image/avif,image/webp,image/png,image/jpeg" },
    redirect: "follow", signal: AbortSignal.timeout(12_000),
  });
  const finalUrl = safePublicUrl(response.url);
  const contentType = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!response.ok || !finalUrl || !contentType.startsWith("image/")) throw new Error("Candidate image could not be downloaded.");
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 8_000_000) throw new Error("Candidate image is too large.");
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : contentType.includes("avif") ? "avif" : "jpg";
  const key = `products/discovered/${product.id}/${crypto.randomUUID()}.${extension}`;
  await getStorage().put(key, bytes, { httpMetadata: { contentType } });
  const image = assetUrl(key);
  await saveProductImage(product, image, "trusted-web-search", candidate.page, candidate.confidence);
  return image;
}

export async function POST() {
  if (!await authorizeAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await ensureProductSeed();
    const catalogue = await loadProducts(true);
    const attempts = await db.prepare("SELECT product_id,MAX(created_at) AS last_attempt FROM image_matches GROUP BY product_id")
      .all<{ product_id: string; last_attempt: string }>();
    const attemptedAt = new Map((attempts.results || []).map(row => [row.product_id, row.last_attempt]));
    const missing = catalogue.filter(product => !product.image).sort((a, b) =>
      String(attemptedAt.get(a.id) || "").localeCompare(String(attemptedAt.get(b.id) || "")));
    const batch = missing.slice(0, 5);
    let matched = 0, failed = 0;
    const matches: { product: string; source: string; confidence: number }[] = [];
    for (const product of batch) {
      try {
        const library = await findAutomaticImage(product.upc, product.name, product.brand);
        if (library) {
          await saveProductImage(product, library.image, library.source, library.image, library.confidence);
          matches.push({ product: product.name, source: library.source, confidence: library.confidence });
          matched++;
          continue;
        }
        const candidate = await searchWeb(product);
        if (candidate) {
          await downloadCandidate(product, candidate);
          matches.push({ product: product.name, source: new URL(candidate.page).hostname, confidence: candidate.confidence });
          matched++;
          continue;
        }
        await db.prepare("INSERT INTO image_matches (id,product_id,source,source_path,confidence,reason,status,created_at) VALUES (?,?,?,?,?,?,?,?)")
          .bind(crypto.randomUUID(), product.id, "trusted-web-search", product.name, 0,
            "No sufficiently confident result was found. The placeholder was kept.", "NoMatch", new Date().toISOString()).run();
      } catch (error) {
        failed++;
        console.error("automatic_product_image_search_failed", product.id, error);
      }
    }
    return NextResponse.json({
      searched: batch.length,
      matched,
      failed,
      remaining: Math.max(0, missing.length - matched),
      matches,
    });
  } catch (error) {
    console.error("automatic_image_search_failed", error);
    return NextResponse.json({ error: "The image search could not be completed right now." }, { status: 500 });
  }
}
