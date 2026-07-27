import { NextRequest, NextResponse } from "next/server";
import { assetUrl } from "../../../../../../db/assets";
import { ensureProductSeed } from "../../../../../../db/catalog";
import { deleteObject, putObject } from "../../../../../../db/storage";
import { importedProducts } from "../../../../../products.generated";
import { authorizeAdmin } from "../../../authorize";

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  try{
    const form=await request.formData(),file=form.get("file");
    if(!(file instanceof File)||!file.type.startsWith("image/")||file.size>900_000)
      return NextResponse.json({error:"Choose a product image under 900 KB."},{status:400});
    const db=await ensureProductSeed();
    let current=await db.prepare("SELECT id,image_key FROM products WHERE id=?").bind(id).first<{id:string;image_key:string|null}>();
    if(!current){
      const source=importedProducts.find(product=>product.id===id);
      if(!source)return NextResponse.json({error:"Product not found."},{status:404});
      await db.prepare("INSERT INTO products (id,upc,slug,name,brand,category,flavour,price,image_key,visible,featured,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(upc) DO NOTHING")
        .bind(source.id,source.upc,source.slug,source.name,source.brand,source.category,source.flavour,source.price,source.image||null,1,source.featured?1:0,new Date().toISOString()).run();
      current=await db.prepare("SELECT id,image_key FROM products WHERE id=?").bind(id).first<{id:string;image_key:string|null}>();
    }
    if(!current)return NextResponse.json({error:"Product not found."},{status:404});
    const key=`products/manual/${crypto.randomUUID()}.webp`;
    await putObject(key,await file.arrayBuffer(),file.type);
    const image=assetUrl(key);
    await db.prepare("UPDATE products SET image_key=?,manual_image=1,updated_at=? WHERE id=?")
      .bind(image,new Date().toISOString(),id).run();
    if(current.image_key?.startsWith("/api/assets/products/manual/")){
      const previous=decodeURIComponent(current.image_key.replace("/api/assets/",""));
      await deleteObject(previous).catch(()=>undefined);
    }
    return NextResponse.json({ok:true,image});
  }catch(error){
    console.error("product_image_upload_failed",error);
    return NextResponse.json({error:"The product image could not be uploaded."},{status:500});
  }
}
