import { NextRequest, NextResponse } from "next/server";
import { ensureProductSeed } from "../../../../../db/catalog";
import { authorizeAdmin } from "../../authorize";
import { importedProducts } from "../../../../products.generated";

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  try{
    const body=await request.json() as Record<string,unknown>;
    const db=await ensureProductSeed();
    let current=await db.prepare("SELECT * FROM products WHERE id = ?").bind(id).first<Record<string,unknown>>();
    if(!current){
      const source=importedProducts.find(product=>product.id===id);
      if(!source)return NextResponse.json({error:"Product not found."},{status:404});
      await db.prepare("INSERT OR IGNORE INTO products (id,upc,slug,name,brand,category,flavour,price,image_key,visible,featured,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(source.id,source.upc,source.slug,source.name,source.brand,source.category,source.flavour,source.price,source.image||null,1,source.featured?1:0,new Date().toISOString()).run();
      current=await db.prepare("SELECT * FROM products WHERE id = ?").bind(id).first<Record<string,unknown>>();
    }
    if(!current)return NextResponse.json({error:"Product not found."},{status:404});
    await db.prepare("DELETE FROM product_deletions WHERE product_id = ?").bind(id).run();
    const name=String(body.name??current.name).trim(),brand=String(body.brand??current.brand).trim();
    const category=String(body.category??current.category).trim(),price=Number(body.price??current.price);
    const image=String(body.image??current.image_key??"").trim();
    if(!name||!brand||!category||category.toLowerCase().includes("hardware")||!Number.isFinite(price)||price<0)
      return NextResponse.json({error:"Enter valid product details. Hardware is excluded."},{status:400});
    await db.prepare("UPDATE products SET name=?,brand=?,category=?,flavour=?,price=?,image_key=?,visible=?,featured=?,manual_name=?,manual_brand=?,manual_category=?,manual_image=?,updated_at=? WHERE id=?")
      .bind(name,brand,category,String(body.flavour??current.flavour??""),price,image||null,
        body.visible===undefined?Number(current.visible):body.visible?1:0,body.featured===undefined?Number(current.featured):body.featured?1:0,
        body.name===undefined?Number(current.manual_name):1,body.brand===undefined?Number(current.manual_brand):1,
        body.category===undefined?Number(current.manual_category):1,body.image===undefined?Number(current.manual_image):1,
        new Date().toISOString(),id).run();
    return NextResponse.json({ok:true});
  }catch(error){console.error("admin_product_update_failed",error);return NextResponse.json({error:"Could not save the product."},{status:500})}
}

export async function DELETE(_:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  const db=await ensureProductSeed();
  await db.batch([
    db.prepare("INSERT OR REPLACE INTO product_deletions (product_id,deleted_at) VALUES (?,?)").bind(id,new Date().toISOString()),
    db.prepare("DELETE FROM products WHERE id = ?").bind(id),
  ]);
  return NextResponse.json({ok:true});
}
