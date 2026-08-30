import { importedProducts } from "../app/products.generated";
import type { Product } from "../app/data";
import { reconcileTemporaryImages, type ImageWorkflowStatus } from "./image-workflow";
import { ensureDatabase } from "./runtime";

export type AdminProduct = Product & {visible:boolean;missingReview:boolean;imageStatus?:ImageWorkflowStatus};
type ProductRow = Record<string,unknown>;

export async function ensureProductSeed(){
  return ensureDatabase();
}

function fromRow(row:ProductRow,fallback?:Product,imageStatus?:ImageWorkflowStatus):AdminProduct{
  const useFallback=imageStatus!=="missing"&&imageStatus!=="temporary";
  return {
    id:String(row.id),upc:String(row.upc),slug:String(row.slug),name:String(row.name),brand:String(row.brand),
    category:String(row.category),flavour:String(row.flavour||fallback?.flavour||""),price:Number(row.price),
    image:String(row.image_key||(useFallback?fallback?.image:"")||"")||undefined,accent:fallback?.accent||"#333333",
    puffCount:fallback?.puffCount,featured:Boolean(row.featured),visible:Boolean(row.visible),
    missingReview:Boolean(row.missing_review),imageStatus,
  };
}

export async function loadProducts(includeHidden=false):Promise<AdminProduct[]>{
  if(!process.env.DATABASE_URL)return importedProducts
    .filter(product=>!["hardware","null"].includes(product.category.toLowerCase()))
    .map(product=>({...product,visible:true,missingReview:false}))
    .sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured))||a.name.localeCompare(b.name));
  const db=await ensureDatabase();
  await reconcileTemporaryImages();
  const [rows,deletions,imageStates]=await Promise.all([
    db.prepare("SELECT * FROM products").all<ProductRow>(),
    db.prepare("SELECT product_id FROM product_deletions").all<{product_id:string}>(),
    db.prepare("SELECT product_id,status FROM product_image_states").all<{product_id:string;status:ImageWorkflowStatus}>(),
  ]);
  const deleted=new Set((deletions.results||[]).map(row=>row.product_id));
  const databaseByUpc=new Map((rows.results||[]).map(row=>[String(row.upc),row]));
  const statusByProduct=new Map((imageStates.results||[]).map(row=>[row.product_id,row.status]));
  const staticByUpc=new Map(importedProducts.map(product=>[product.upc,product]));
  const catalogue:AdminProduct[]=[];

  for(const product of importedProducts){
    if(["hardware","null"].includes(product.category.toLowerCase())||deleted.has(product.id))continue;
    const row=databaseByUpc.get(product.upc);
    const merged=row?fromRow(row,product,statusByProduct.get(String(row.id))):{...product,visible:true,missingReview:false};
    if(includeHidden||merged.visible)catalogue.push(merged);
    databaseByUpc.delete(product.upc);
  }
  for(const row of databaseByUpc.values()){
    if(["hardware","null"].includes(String(row.category).toLowerCase())||deleted.has(String(row.id)))continue;
    const product=fromRow(row,staticByUpc.get(String(row.upc)),statusByProduct.get(String(row.id)));
    if(includeHidden||product.visible)catalogue.push(product);
  }
  return catalogue.sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured))||a.name.localeCompare(b.name));
}
