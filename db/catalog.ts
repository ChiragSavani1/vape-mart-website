import { importedProducts } from "../app/products.generated";
import type { Product } from "../app/data";
import { ensureDatabase } from "./runtime";

export type AdminProduct = Product & {visible:boolean;missingReview:boolean};
type ProductRow = Record<string,unknown>;

export async function ensureProductSeed(){
  return ensureDatabase();
}

function fromRow(row:ProductRow,fallback?:Product):AdminProduct{
  return {
    id:String(row.id),upc:String(row.upc),slug:String(row.slug),name:String(row.name),brand:String(row.brand),
    category:String(row.category),flavour:String(row.flavour||fallback?.flavour||""),price:Number(row.price),
    image:String(row.image_key||fallback?.image||"")||undefined,accent:fallback?.accent||"#333333",
    puffCount:fallback?.puffCount,featured:Boolean(row.featured),visible:Boolean(row.visible),
    missingReview:Boolean(row.missing_review),
  };
}

export async function loadProducts(includeHidden=false):Promise<AdminProduct[]>{
  const db=await ensureDatabase();
  const [rows,deletions]=await Promise.all([
    db.prepare("SELECT * FROM products").all<ProductRow>(),
    db.prepare("SELECT product_id FROM product_deletions").all<{product_id:string}>(),
  ]);
  const deleted=new Set((deletions.results||[]).map(row=>row.product_id));
  const databaseByUpc=new Map((rows.results||[]).map(row=>[String(row.upc),row]));
  const staticByUpc=new Map(importedProducts.map(product=>[product.upc,product]));
  const catalogue:AdminProduct[]=[];

  for(const product of importedProducts){
    if(["hardware","null"].includes(product.category.toLowerCase())||deleted.has(product.id))continue;
    const row=databaseByUpc.get(product.upc);
    const merged=row?fromRow(row,product):{...product,visible:true,missingReview:false};
    if(includeHidden||merged.visible)catalogue.push(merged);
    databaseByUpc.delete(product.upc);
  }
  for(const row of databaseByUpc.values()){
    if(["hardware","null"].includes(String(row.category).toLowerCase())||deleted.has(String(row.id)))continue;
    const product=fromRow(row,staticByUpc.get(String(row.upc)));
    if(includeHidden||product.visible)catalogue.push(product);
  }
  return catalogue.sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured))||a.name.localeCompare(b.name));
}
