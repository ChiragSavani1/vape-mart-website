import { NextRequest, NextResponse } from "next/server";
import { normalizeAssetName } from "../../../../db/assets";
import { ensureDatabase } from "../../../../db/runtime";
import { putObject } from "../../../../db/storage";
import { authorizeAdmin } from "../authorize";

const safeName=(value:string)=>value.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").slice(-120);

export async function POST(request:NextRequest){
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const form=await request.formData();
    const files=form.getAll("files").filter((value):value is File=>value instanceof File);
    if(!files.length||files.length>100||files.some(file=>!file.type.startsWith("image/"))||files.reduce((sum,file)=>sum+file.size,0)>50_000_000)
      return NextResponse.json({error:"Upload 1–100 image files with a combined size under 50 MB."},{status:400});
    const db=await ensureDatabase();let exactMatches=0;
    for(const file of files){
      const id=crypto.randomUUID(),key=`product-library/${id}-${safeName(file.name)}`;
      await putObject(key,await file.arrayBuffer(),file.type);
      await db.prepare("INSERT INTO image_assets (id,object_key,original_name,normalized_name,created_at) VALUES (?,?,?,?,?)")
        .bind(id,key,file.name,normalizeAssetName(file.name),new Date().toISOString()).run();
      const digits=file.name.match(/\d{8,14}/)?.[0]||"";
      if(digits){
        const result=await db.prepare("UPDATE products SET image_key=?,manual_image=0,updated_at=? WHERE upc=? AND (image_key IS NULL OR image_key='')")
          .bind(`/api/assets/${key.split("/").map(encodeURIComponent).join("/")}`,new Date().toISOString(),digits).run();
        exactMatches+=result.meta.changes||0;
      }
    }
    return NextResponse.json({ok:true,uploaded:files.length,exactMatches});
  }catch(error){console.error("image_library_upload_failed",error);return NextResponse.json({error:"The product images could not be uploaded."},{status:500})}
}
