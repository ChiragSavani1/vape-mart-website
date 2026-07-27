import { importedProducts } from "../app/products.generated";
import { ensureDatabase } from "./runtime";

export type SiteBanner={id:string;src:string;alt:string;position:number};
type ImageAsset={object_key:string;original_name:string;normalized_name:string};

export const assetUrl=(key:string)=>`/api/assets/${key.split("/").map(encodeURIComponent).join("/")}`;
export const normalizeAssetName=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/\.[a-z0-9]+$/i,"").replace(/[^a-z0-9]+/g," ").trim();

export async function loadBanners():Promise<SiteBanner[]>{
  const db=await ensureDatabase();
  const result=await db.prepare("SELECT id,object_key,alt_text,position FROM banners ORDER BY position ASC LIMIT 6").all<{id:string;object_key:string;alt_text:string;position:number}>();
  return (result.results||[]).map(row=>({id:row.id,src:assetUrl(row.object_key),alt:row.alt_text,position:row.position}));
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
