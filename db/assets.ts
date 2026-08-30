import { importedProducts } from "../app/products.generated";
import { reconcileTemporaryBanners } from "./image-workflow";
import { ensureDatabase } from "./runtime";

export type SiteBanner={id:string;src:string;alt:string;position:number;headline:string;subtitle:string;label:string;ctaText:string;ctaUrl:string;active:boolean};
type ImageAsset={object_key:string;original_name:string;normalized_name:string};

export const assetUrl=(key:string)=>`/api/assets/${key.split("/").map(encodeURIComponent).join("/")}`;
export const normalizeAssetName=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/\.[a-z0-9]+$/i,"").replace(/[^a-z0-9]+/g," ").trim();

export async function loadBanners(includeInactive=false):Promise<SiteBanner[]>{
  if(!process.env.DATABASE_URL)return [];
  await reconcileTemporaryBanners();
  const db=await ensureDatabase();
  const result=await db.prepare(`SELECT id,public_url,alt_text,position,headline,subtitle,label,cta_text,cta_url,active FROM banners
    WHERE public_url IS NOT NULL ${includeInactive?"":"AND active=1"} AND image_status IN ('temporary','pending_deployment','archiving','archived_verified')
    ORDER BY position ASC LIMIT 6`).all<{id:string;public_url:string;alt_text:string;position:number}>();
  return (result.results||[]).map(row=>{const item=row as typeof row&{headline?:string;subtitle?:string;label?:string;cta_text?:string;cta_url?:string;active?:number};return {id:item.id,src:item.public_url,alt:item.alt_text,position:item.position,headline:item.headline||"",subtitle:item.subtitle||"",label:item.label||"",ctaText:item.cta_text||"",ctaUrl:item.cta_url||"/#catalogue",active:Boolean(item.active)}});
}

function scoreAsset(asset:ImageAsset,upc:string,name:string,brand:string){
  const digits=asset.original_name.replace(/\D/g,"");
  if(upc.length>=8&&digits.includes(upc))return 1;
  const productTokens=new Set(normalizeAssetName(`${brand} ${name}`).split(" ").filter(token=>token.length>2));
  const assetTokens=new Set(asset.normalized_name.split(" ").filter(token=>token.length>2));
  const matched=[...productTokens].filter(token=>assetTokens.has(token)).length;
  return productTokens.size?matched/productTokens.size:0;
}

export async function findAutomaticImage(upc:string,name:string,brand:string){
  const staticMatch=importedProducts.find(product=>product.upc===upc&&product.image)
    || importedProducts.find(product=>product.image&&normalizeAssetName(product.name)===normalizeAssetName(name));
  if(staticMatch?.image)return {image:staticMatch.image,confidence:1,source:"catalogue"};
  const db=await ensureDatabase();
  const assets=await db.prepare("SELECT object_key,original_name,normalized_name FROM image_assets ORDER BY created_at DESC LIMIT 3000").all<ImageAsset>();
  let best:{asset:ImageAsset;score:number}|undefined;
  for(const asset of assets.results||[]){
    const score=scoreAsset(asset,upc,name,brand);
    if(!best||score>best.score)best={asset,score};
  }
  return best&&best.score>=0.72?{image:assetUrl(best.asset.object_key),confidence:best.score,source:"uploaded-library"}:null;
}
