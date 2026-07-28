import { NextRequest, NextResponse } from "next/server";
import { ensureProductSeed } from "../../../../../../db/catalog";
import { markImageTemporary } from "../../../../../../db/image-workflow";
import { writeTemporaryProductImage } from "../../../../../../db/temporary-images";
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
    let current=await db.prepare("SELECT id,upc,image_key FROM products WHERE id=?").bind(id).first<{id:string;upc:string;image_key:string|null}>();
    if(!current){
      const source=importedProducts.find(product=>product.id===id);
      if(!source)return NextResponse.json({error:"Product not found."},{status:404});
      await db.prepare("INSERT INTO products (id,upc,slug,name,brand,category,flavour,price,image_key,visible,featured,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(upc) DO NOTHING")
        .bind(source.id,source.upc,source.slug,source.name,source.brand,source.category,source.flavour,source.price,source.image||null,1,source.featured?1:0,new Date().toISOString()).run();
      current=await db.prepare("SELECT id,upc,image_key FROM products WHERE id=?").bind(id).first<{id:string;upc:string;image_key:string|null}>();
    }
    if(!current)return NextResponse.json({error:"Product not found."},{status:404});
    const extension=file.type.includes("png")?"png":file.type.includes("avif")?"avif":file.type.includes("jpeg")?"jpg":"webp";
    const temporary=await writeTemporaryProductImage(id,await file.arrayBuffer(),extension);
    const image=temporary.url;
    await markImageTemporary({id,upc:current.upc},temporary.filePath,image,current.image_key||"manual-admin-upload");
    await db.prepare("UPDATE products SET image_key=?,manual_image=1,updated_at=? WHERE id=?")
      .bind(image,new Date().toISOString(),id).run();
    return NextResponse.json({ok:true,image});
  }catch(error){
    console.error("product_image_upload_failed",error);
    return NextResponse.json({error:"The product image could not be uploaded."},{status:500});
  }
}
