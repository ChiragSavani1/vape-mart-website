import { NextRequest, NextResponse } from "next/server";
import { read, utils } from "xlsx";
import { ensureDatabase } from "../../../../db/runtime";
import { findAutomaticImage } from "../../../../db/assets";
import { getChatGPTUser } from "../../../chatgpt-auth";

export const dynamic = "force-dynamic";

type ImportRow = Record<string, unknown>;
const findValue = (row:ImportRow, names:string[]) => {
  const key = Object.keys(row).find(k => names.includes(k.trim().toLowerCase()));
  return key ? row[key] : "";
};
const cleanUpc = (value:unknown) => String(value ?? "").replace(/\D/g,"");
const slugify = (value:string) => value.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g,"").trim().replace(/[\s_]+/g,"-").slice(0,90);

async function authorized() {
  const user = await getChatGPTUser(); if (!user) return false;
  const allowed = (process.env.ADMIN_EMAILS || "").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(user.email.toLowerCase());
}

export async function POST(request:NextRequest) {
  if (!await authorized()) return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || file.size > 20_000_000) return NextResponse.json({error:"Choose an Excel or CSV file under 20 MB."},{status:400});
    const workbook = read(await file.arrayBuffer(), {type:"array"});
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = utils.sheet_to_json<ImportRow>(sheet,{defval:""});
    const db = await ensureDatabase();
    const seen = new Set<string>(), imported = new Set<string>();
    let added=0,updated=0,duplicates=0,hardware=0,imagesMatched=0,imagesUnmatched=0;
    for(const row of rows){
      const upc=cleanUpc(findValue(row,["upc","barcode","upc code","sku/upc"]));
      const name=String(findValue(row,["product name","name","item","description"])).trim();
      const category=String(findValue(row,["category","department","product category"])).trim();
      const brand=String(findValue(row,["brand","manufacturer"])).trim()||"Unbranded";
      const price=Number(findValue(row,["retail price","price","selling price","msrp"]));
      if(category.toLowerCase().includes("hardware")){hardware++;continue}
      if(!upc||!name||!Number.isFinite(price))continue;
      if(seen.has(upc)){duplicates++;continue} seen.add(upc); imported.add(upc);
      const existing=await db.prepare("SELECT id, image_key, manual_name, manual_brand, manual_category FROM products WHERE upc = ?").bind(upc).first<{id:string;image_key:string|null;manual_name:number;manual_brand:number;manual_category:number}>();
      if(existing){
        await db.prepare("UPDATE products SET name = CASE WHEN manual_name = 1 THEN name ELSE ? END, brand = CASE WHEN manual_brand = 1 THEN brand ELSE ? END, category = CASE WHEN manual_category = 1 THEN category ELSE ? END, price = ?, missing_review = 0, updated_at = ? WHERE upc = ?")
          .bind(name,brand,category,price,new Date().toISOString(),upc).run(); updated++;
        if(!existing.image_key){
          const match=await findAutomaticImage(upc,name,brand);
          if(match){await db.prepare("UPDATE products SET image_key=? WHERE upc=?").bind(match.image,upc).run();imagesMatched++}
        }
      }else{
        const match=await findAutomaticImage(upc,name,brand);
        await db.prepare("INSERT INTO products (id, upc, slug, name, brand, category, price, image_key, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(),upc,`${slugify(name)}-${upc.slice(-4)}`,name,brand,category,price,match?.image||null,new Date().toISOString()).run(); added++;
        if(match)imagesMatched++;else imagesUnmatched++;
      }
    }
    const existingUpcs=await db.prepare("SELECT upc FROM products WHERE visible = 1").all<{upc:string}>();
    const missing=existingUpcs.results.filter(x=>!imported.has(x.upc)).map(x=>x.upc);
    if(missing.length) await db.batch(missing.map(upc=>db.prepare("UPDATE products SET missing_review = 1 WHERE upc = ?").bind(upc)));
    const summary={added,updated,duplicates,hardware,review:missing.length,imagesMatched,imagesUnmatched};
    await db.prepare("INSERT INTO import_runs (id,filename,added,updated,duplicates,hardware_skipped,review,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),file.name,added,updated,duplicates,hardware,missing.length,new Date().toISOString()).run();
    return NextResponse.json({ok:true,summary});
  }catch(error){console.error("excel_import_failed",error);return NextResponse.json({error:"The workbook could not be imported."},{status:500})}
}
