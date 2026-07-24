import { importedProducts } from "../app/products.generated";
import type { Product } from "../app/data";
import { ensureDatabase } from "./runtime";

export type AdminProduct = Product & {visible:boolean;missingReview:boolean};

export async function ensureProductSeed(){
  const db=await ensureDatabase();
  const count=await db.prepare("SELECT COUNT(*) AS count FROM products").first<{count:number}>();
  if((count?.count||0)===0){
    const now=new Date().toISOString();
    for(let offset=0;offset<importedProducts.length;offset+=50){
      await db.batch(importedProducts.slice(offset,offset+50).map(product=>db.prepare(
        "INSERT OR IGNORE INTO products (id,upc,slug,name,brand,category,flavour,price,image_key,visible,featured,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(product.id,product.upc,product.slug,product.name,product.brand,product.category,product.flavour,product.price,product.image||null,1,product.featured?1:0,now)));
    }
  }
  return db;
}

export async function loadProducts(includeHidden=false):Promise<AdminProduct[]>{
  const db=await ensureProductSeed();
  const result=await db.prepare(`SELECT * FROM products ${includeHidden?"":"WHERE visible = 1"} ORDER BY featured DESC, name ASC`).all<Record<string,unknown>>();
  const staticByUpc=new Map(importedProducts.map(product=>[product.upc,product]));
  return (result.results||[]).filter(row=>String(row.category).toLowerCase()!=="hardware").map(row=>{
    const fallback=staticByUpc.get(String(row.upc));
    return {
      id:String(row.id),upc:String(row.upc),slug:String(row.slug),name:String(row.name),brand:String(row.brand),
      category:String(row.category),flavour:String(row.flavour||fallback?.flavour||""),price:Number(row.price),
      image:String(row.image_key||fallback?.image||"")||undefined,accent:fallback?.accent||"#333333",
      puffCount:fallback?.puffCount,featured:Boolean(row.featured),visible:Boolean(row.visible),
      missingReview:Boolean(row.missing_review),
    };
  });
}
