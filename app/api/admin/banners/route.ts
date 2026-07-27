import { NextRequest, NextResponse } from "next/server";
import { loadBanners } from "../../../../db/assets";
import { ensureDatabase } from "../../../../db/runtime";
import { putObject } from "../../../../db/storage";
import { authorizeAdmin } from "../authorize";

const safeName=(value:string)=>value.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").slice(-100);

export async function GET(){
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  return NextResponse.json({banners:await loadBanners()});
}

export async function POST(request:NextRequest){
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const form=await request.formData(),file=form.get("file"),alt=String(form.get("alt")||"Vape Mart promotion").trim().slice(0,180);
    if(!(file instanceof File)||!file.type.startsWith("image/")||file.size>12_000_000)return NextResponse.json({error:"Choose an image under 12 MB."},{status:400});
    const db=await ensureDatabase();
    const count=await db.prepare("SELECT COUNT(*) AS count FROM banners").first<{count:number}>();
    if((count?.count||0)>=6)return NextResponse.json({error:"A maximum of six hero banners is allowed."},{status:400});
    const id=crypto.randomUUID(),key=`banners/${id}-${safeName(file.name)}`;
    await putObject(key,await file.arrayBuffer(),file.type);
    await db.prepare("INSERT INTO banners (id,object_key,alt_text,position,created_at) VALUES (?,?,?,?,?)")
      .bind(id,key,alt,count?.count||0,new Date().toISOString()).run();
    return NextResponse.json({ok:true,banners:await loadBanners()},{status:201});
  }catch(error){console.error("banner_upload_failed",error);return NextResponse.json({error:"The banner could not be uploaded."},{status:500})}
}
