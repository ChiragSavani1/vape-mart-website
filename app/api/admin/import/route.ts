import { NextRequest, NextResponse } from "next/server";
import { read, utils } from "xlsx";
import { ensureDatabase, type PostgresPreparedQuery } from "../../../../db/runtime";
import { findAutomaticImage } from "../../../../db/assets";
import { authorizeAdmin } from "../authorize";
import { importedProducts } from "../../../products.generated";
import { reconcileTemporaryImages } from "../../../../db/image-workflow";

export const dynamic = "force-dynamic";

type ImportRow = Record<string, unknown>;
const normalizeHeader=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9]+/g,"");
const findValue = (row:ImportRow, names:string[]) => {
  const accepted=new Set(names.map(normalizeHeader));
  const key = Object.keys(row).find(k => accepted.has(normalizeHeader(k)));
  return key ? row[key] : "";
};
const cleanUpc = (value:unknown) => String(value ?? "").match(/\d{8,14}/)?.[0]||"";
const slugify = (value:string) => value.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g,"").trim().replace(/[\s_]+/g,"-").slice(0,90);
const hasRequiredHeaders=(row:unknown[])=>{
  const headers=new Set(row.map(value=>normalizeHeader(String(value||""))));
  return ["upc","barcode","upccode","skuupc"].some(name=>headers.has(name))
    && ["itemname","productname","name","item","description"].some(name=>headers.has(name))
    && ["retailprice","price","sellingprice","msrp"].some(name=>headers.has(name));
};
const readRows=(workbook:ReturnType<typeof read>)=>{
  for(const sheetName of workbook.SheetNames){
    const sheet=workbook.Sheets[sheetName];
    const preview=utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:""});
    const headerRow=preview.slice(0,25).findIndex(hasRequiredHeaders);
    if(headerRow>=0)return utils.sheet_to_json<ImportRow>(sheet,{defval:"",range:headerRow});
  }
  return null;
};

export async function POST(request:NextRequest) {
  if (!await authorizeAdmin()) return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || file.size > 20_000_000) return NextResponse.json({error:"Choose an Excel or CSV file under 20 MB."},{status:400});
    const workbook = read(await file.arrayBuffer(), {type:"array"});
    const rows = readRows(workbook);
    if(!rows)return NextResponse.json({error:"No RetailzPOS product table was found. The file must include UPC, Item Name, and Retail Price columns."},{status:400});
    const seen = new Set<string>();
    const products:{upc:string;sku:string;name:string;category:string;brand:string;flavour:string;price:number}[]=[];
    let duplicates=0,hardware=0,skippedRows=0;
    for(const row of rows){
      const upc=cleanUpc(findValue(row,["upc","barcode","upc code","sku/upc"]));
      const sku=String(findValue(row,["sku","item sku","product sku","item number"])).trim();
      const name=String(findValue(row,["item name","product name","name","item","description"])).trim();
      const category=String(findValue(row,["department name","department","category","product category"])).trim();
      const brand=String(findValue(row,["category name","brand","manufacturer"])).trim()||"Unbranded";
      const flavour=String(findValue(row,["sub category name","subcategory name","sub category","subcategory","flavour","flavor","variant"])).trim();
      const price=Number(findValue(row,["retail price","price","selling price","msrp"]));
      if(category.toLowerCase().includes("hardware")){hardware++;continue}
      if(!upc||!name||!category||category.toLowerCase()==="null"||!Number.isFinite(price)){skippedRows++;continue}
      if(seen.has(upc)){duplicates++;continue}
      seen.add(upc);products.push({upc,sku,name,category,brand,flavour,price});
    }
    if(!products.length)return NextResponse.json({error:"No importable products were found. Check the UPC, Item Name, Department Name, and Retail Price columns."},{status:400});
    const db = await ensureDatabase();
    await reconcileTemporaryImages();
    const imported = new Set(products.map(product=>product.upc));
    const staticByUpc=new Map(importedProducts.map(product=>[product.upc,product]));
    const databaseRows=await db.prepare("SELECT id,upc,slug,image_key FROM products").all<{id:string;upc:string;slug:string;image_key:string|null}>();
    const databaseByUpc=new Map((databaseRows.results||[]).map(product=>[product.upc,product]));
    const writes:PostgresPreparedQuery[]=[];
    const missingImageStates:{id:string;upc:string;sku:string}[]=[];
    let added=0,updated=0,imagesMatched=0,imagesUnmatched=0;
    for(const {upc,sku,name,category,brand,flavour,price} of products){
      const existing=databaseByUpc.get(upc);
      const staticProduct=staticByUpc.get(upc);
      let image=existing?.image_key||staticProduct?.image||null;
      if(!image){
        const match=await findAutomaticImage(upc,name,brand);
        image=match?.image||null;
        if(match)imagesMatched++;
      }
      if(existing||staticProduct)updated++;else{added++;if(!image)imagesUnmatched++}
      const productId=existing?.id||staticProduct?.id||crypto.randomUUID();
      if(!image)missingImageStates.push({id:productId,upc,sku});
      writes.push(db.prepare(`INSERT INTO products (id,upc,slug,name,brand,category,flavour,price,image_key,visible,featured,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(upc) DO UPDATE SET
          name=CASE WHEN products.manual_name=1 THEN products.name ELSE excluded.name END,
          brand=CASE WHEN products.manual_brand=1 THEN products.brand ELSE excluded.brand END,
          category=CASE WHEN products.manual_category=1 THEN products.category ELSE excluded.category END,
          flavour=excluded.flavour,price=excluded.price,
          image_key=CASE WHEN products.manual_image=1 THEN products.image_key ELSE COALESCE(NULLIF(products.image_key,''),excluded.image_key) END,
          missing_review=0,updated_at=excluded.updated_at`)
        .bind(productId,upc,existing?.slug||staticProduct?.slug||`${slugify(name)}-${upc.slice(-4)}`,
          name,brand,category,flavour,price,image,1,staticProduct?.featured?1:0,new Date().toISOString()));
    }
    for(let index=0;index<writes.length;index+=75)await db.batch(writes.slice(index,index+75));
    if(missingImageStates.length) {
      const now=new Date().toISOString();
      const stateWrites=missingImageStates.map(product=>db.prepare(`INSERT INTO product_image_states
        (product_id,status,sku,upc,retry_count,retry_requested,updated_at)
        VALUES (?,?,?,?,0,0,?)
        ON CONFLICT(product_id) DO UPDATE SET
          sku=COALESCE(NULLIF(excluded.sku,''),product_image_states.sku),
          upc=excluded.upc,
          status=CASE WHEN product_image_states.status='archived' THEN product_image_states.status ELSE 'missing' END,
          updated_at=excluded.updated_at`)
        .bind(product.id,"missing",product.sku||null,product.upc,now));
      for(let index=0;index<stateWrites.length;index+=75)await db.batch(stateWrites.slice(index,index+75));
    }
    const existingUpcs=await db.prepare("SELECT upc FROM products WHERE visible = 1").all<{upc:string}>();
    const missing=existingUpcs.results.filter(x=>!imported.has(x.upc)).map(x=>x.upc);
    if(missing.length) await db.batch(missing.map(upc=>db.prepare("UPDATE products SET missing_review = 1 WHERE upc = ?").bind(upc)));
    const summary={added,updated,duplicates,hardware,review:missing.length,imagesMatched,imagesUnmatched,skippedRows,totalRows:rows.length};
    await db.prepare("INSERT INTO import_runs (id,filename,added,updated,duplicates,hardware_skipped,review,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),file.name,added,updated,duplicates,hardware,missing.length,new Date().toISOString()).run();
    return NextResponse.json({ok:true,summary});
  }catch(error){console.error("excel_import_failed",error);return NextResponse.json({error:"The workbook could not be imported."},{status:500})}
}
