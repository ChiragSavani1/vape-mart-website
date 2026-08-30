import { NextResponse } from "next/server";
import { loadBanners } from "../../../../../db/assets";
import { ensureDatabase } from "../../../../../db/runtime";
import { removeTemporaryBanner } from "../../../../../db/temporary-banners";
import { authorizeAdmin } from "../../authorize";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params,input=await request.json().catch(()=>null),db=await ensureDatabase();
  if(!input||typeof input!=="object")return NextResponse.json({error:"Invalid banner update."},{status:400});
  const position=Math.max(0,Math.min(5,Number(input.position)||0)),active=input.active?1:0,now=new Date().toISOString();
  await db.prepare("UPDATE banners SET headline=?,subtitle=?,label=?,cta_text=?,cta_url=?,alt_text=?,position=?,active=?,updated_at=? WHERE id=?")
    .bind(String(input.headline||"").slice(0,120),String(input.subtitle||"").slice(0,240),String(input.label||"").slice(0,60),String(input.ctaText||"").slice(0,60),String(input.ctaUrl||"/#catalogue").slice(0,300),String(input.alt||"Vape Mart promotion").slice(0,180),position,active,now,id).run();
  return NextResponse.json({ok:true,banners:await loadBanners(true)});
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params,db=await ensureDatabase();
  const banner=await db.prepare("SELECT temporary_path FROM banners WHERE id=?").bind(id).first<{temporary_path:string|null}>();
  if(!banner)return NextResponse.json({error:"Banner not found."},{status:404});
  await removeTemporaryBanner(banner.temporary_path);
  await db.prepare("DELETE FROM banners WHERE id=?").bind(id).run();
  const remaining=await db.prepare("SELECT id FROM banners WHERE image_status IN ('temporary','pending_deployment','archiving','archived_verified') ORDER BY position,created_at").all<{id:string}>();
  if(remaining.results.length)await db.batch(remaining.results.map((row,index)=>db.prepare("UPDATE banners SET position=? WHERE id=?").bind(index,row.id)));
  return NextResponse.json({ok:true,banners:await loadBanners(true)});
}
