import { NextResponse } from "next/server";
import type { AdminProduct } from "../../../../db/catalog";
import { ensureProductSeed, loadProducts } from "../../../../db/catalog";
import { findAutomaticImage, normalizeAssetName } from "../../../../db/assets";
import {
  ensureMissingImageState,
  markImageArchived,
  markImageTemporary,
  recordImageSearchFailure,
  requestImageRetry,
} from "../../../../db/image-workflow";
import { writeTemporaryProductImage } from "../../../../db/temporary-images";
import { authorizeAdmin } from "../authorize";

type WebResult = { title?: string; image?: string; url?: string };
type Candidate = { title: string; image: string; page: string; confidence: number };
type QueueRow={product_id:string;retry_requested:number;last_search_at:string|null};

const BATCH_SIZE=5;
const RETRY_COOLDOWN_MS=6*60*60*1000;
const trustedOfficialHosts = [
  "stlthvape.com","flavourbeast.com","twelvemonkeysvapor.com","envi.com","envi-vape.com",
  "geekbar.com","uwell.com","voopoo.com","vaporesso.com",
];
const ignoredTokens = new Set([
  "vape","vaping","product","products","device","disposable","pod","pods",
  "online","shop","store","canada","ontario","buy","new","the","with",
]);

function safePublicUrl(value:string) {
  try {
    const url=new URL(value);
    const host=url.hostname.toLowerCase();
    if(!["http:","https:"].includes(url.protocol)||host==="localhost"||host.endsWith(".local"))return null;
    if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)||host.includes(":"))return null;
    return url;
  } catch{return null}
}

function trustedPage(value:string) {
  const url=safePublicUrl(value);
  if(!url)return null;
  const host=url.hostname.toLowerCase().replace(/^www\./,"");
  return host.endsWith(".ca")||trustedOfficialHosts.some(domain=>host===domain||host.endsWith(`.${domain}`))?url:null;
}

function meaningfulTokens(value:string) {
  return normalizeAssetName(value).split(" ").filter(token=>token.length>2&&!ignoredTokens.has(token));
}

function scoreResult(product:AdminProduct,result:WebResult) {
  const page=result.url?trustedPage(result.url):null;
  const image=result.image?safePublicUrl(result.image):null;
  if(!page||!image||!result.title)return null;
  const productTokens=[...new Set(meaningfulTokens(`${product.brand} ${product.name} ${product.flavour}`))];
  const candidateTokens=new Set(meaningfulTokens(`${result.title} ${page.pathname}`));
  const brandTokens=meaningfulTokens(product.brand);
  if(brandTokens.length&&!brandTokens.some(token=>candidateTokens.has(token)))return null;
  const matched=productTokens.filter(token=>candidateTokens.has(token)).length;
  const confidence=productTokens.length?matched/productTokens.length:0;
  return confidence>=.72?{title:result.title,image:image.href,page:page.href,confidence}:null;
}

async function searchWeb(product:AdminProduct):Promise<Candidate|null> {
  const query=[product.brand,product.name,product.flavour].filter(Boolean).join(" ");
  const headers={"user-agent":"Mozilla/5.0 (compatible; VapeMartImageReview/1.0)","accept-language":"en-CA,en;q=0.9"};
  const landing=await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,{
    headers,cache:"no-store",signal:AbortSignal.timeout(10_000),
  });
  if(!landing.ok)return null;
  const html=await landing.text();
  const vqd=html.match(/vqd=["']([^"']+)/)?.[1];
  if(!vqd)return null;
  const response=await fetch(`https://duckduckgo.com/i.js?l=ca-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,`,{
    headers:{...headers,referer:landing.url},cache:"no-store",signal:AbortSignal.timeout(10_000),
  });
  if(!response.ok)return null;
  const payload=await response.json() as {results?:WebResult[]};
  return (payload.results||[]).map(result=>scoreResult(product,result))
    .filter((candidate):candidate is Candidate=>Boolean(candidate))
    .sort((a,b)=>b.confidence-a.confidence)[0]||null;
}

async function persistProduct(product:AdminProduct,image?:string) {
  const db=await ensureProductSeed();
  const now=new Date().toISOString();
  await db.prepare(`INSERT INTO products
    (id,upc,slug,name,brand,category,flavour,price,image_key,visible,featured,manual_image,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(upc) DO UPDATE SET
      name=excluded.name,brand=excluded.brand,category=excluded.category,flavour=excluded.flavour,
      price=excluded.price,image_key=COALESCE(excluded.image_key,products.image_key),updated_at=excluded.updated_at`)
    .bind(product.id,product.upc,product.slug,product.name,product.brand,product.category,product.flavour,
      product.price,image||null,product.visible?1:0,product.featured?1:0,0,now).run();
}

async function addHistory(product:AdminProduct,source:string,sourcePath:string,storedKey:string|null,confidence:number,status:string,reason:string) {
  const db=await ensureProductSeed();
  await db.prepare("INSERT INTO image_matches (id,product_id,source,source_path,stored_key,confidence,reason,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),product.id,source,sourcePath,storedKey,confidence,reason,status,new Date().toISOString()).run();
}

async function savePersistentMatch(product:AdminProduct,image:string,source:string,sourcePath:string,confidence:number) {
  await persistProduct(product,image);
  await markImageArchived(product,image,sourcePath);
  await addHistory(product,source,sourcePath,image,confidence,"Approved","Matched to an existing persistent catalogue image.");
}

async function downloadCandidate(product:AdminProduct,candidate:Candidate) {
  const response=await fetch(candidate.image,{
    headers:{"user-agent":"Mozilla/5.0 (compatible; VapeMartImageReview/1.0)",accept:"image/avif,image/webp,image/png,image/jpeg"},
    redirect:"follow",signal:AbortSignal.timeout(12_000),
  });
  const finalUrl=safePublicUrl(response.url);
  const contentType=(response.headers.get("content-type")||"").split(";")[0].toLowerCase();
  if(!response.ok||!finalUrl||!contentType.startsWith("image/"))throw new Error("Candidate image could not be downloaded.");
  const bytes=await response.arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>8_000_000)throw new Error("Candidate image is too large.");
  const extension=contentType.includes("png")?"png":contentType.includes("webp")?"webp":contentType.includes("avif")?"avif":"jpg";
  const temporary=await writeTemporaryProductImage(product.id,bytes,extension);
  await persistProduct(product);
  await markImageTemporary(product,temporary.filePath,temporary.url,candidate.page);
  await addHistory(product,"trusted-web-search",candidate.page,temporary.url,candidate.confidence,"Temporary",
    "High-confidence match downloaded to temporary Render storage and queued for archive.");
  return temporary.url;
}

export async function POST(request:Request) {
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
    const requested=await request.json().catch(()=>({})) as {productId?:string};
    const db=await ensureProductSeed();
    const catalogue=await loadProducts(true);
    const missing=catalogue.filter(product=>!product.image);
    for(const product of missing) {
      await persistProduct(product);
      await ensureMissingImageState(product);
    }
    if(requested.productId)await requestImageRetry(requested.productId);

    const queueRows=await db.prepare(`SELECT product_id,retry_requested,last_search_at
      FROM product_image_states WHERE status='missing'
      ORDER BY retry_requested DESC,last_search_at ASC NULLS FIRST,updated_at ASC`)
      .all<QueueRow>();
    const byId=new Map(missing.map(product=>[product.id,product]));
    const cutoff=Date.now()-RETRY_COOLDOWN_MS;
    const eligible=(queueRows.results||[]).filter(row=>
      byId.has(row.product_id)&&(
        row.retry_requested===1||
        !row.last_search_at||
        Date.parse(row.last_search_at)<cutoff
      ));
    if(requested.productId)eligible.sort((a,b)=>Number(b.product_id===requested.productId)-Number(a.product_id===requested.productId));
    const batch=eligible.slice(0,BATCH_SIZE).map(row=>byId.get(row.product_id)).filter((product):product is AdminProduct=>Boolean(product));

    let matched=0,failed=0;
    const matches:{product:string;source:string;confidence:number}[]=[];
    for(const product of batch) {
      let candidate:Candidate|null=null;
      try {
        const library=await findAutomaticImage(product.upc,product.name,product.brand);
        if(library) {
          await savePersistentMatch(product,library.image,library.source,library.image,library.confidence);
          matches.push({product:product.name,source:library.source,confidence:library.confidence});
          matched++;
          continue;
        }
        candidate=await searchWeb(product);
        if(candidate) {
          await downloadCandidate(product,candidate);
          matches.push({product:product.name,source:new URL(candidate.page).hostname,confidence:candidate.confidence});
          matched++;
          continue;
        }
        const reason="No sufficiently confident result was found. The placeholder remains visible.";
        await recordImageSearchFailure(product,reason);
        await addHistory(product,"trusted-web-search",product.name,null,0,"NoMatch",reason);
        failed++;
      } catch(error) {
        const reason=error instanceof Error?error.message:"The image source could not be searched.";
        await recordImageSearchFailure(product,reason,candidate?.page);
        await addHistory(product,"trusted-web-search",candidate?.page||product.name,null,0,"Failed",reason);
        failed++;
        console.error("automatic_product_image_search_failed",product.id,error);
      }
    }
    const remaining=(queueRows.results||[]).length-matched;
    return NextResponse.json({searched:batch.length,matched,failed,remaining:Math.max(0,remaining),matches,batchLimit:BATCH_SIZE});
  } catch(error) {
    console.error("automatic_image_search_failed",error);
    return NextResponse.json({error:"The image search could not be completed right now."},{status:500});
  }
}
