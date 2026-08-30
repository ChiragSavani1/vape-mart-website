import { NextRequest, NextResponse } from "next/server";
import { loadBanners } from "../../../../db/assets";
import { ensureDatabase } from "../../../../db/runtime";
import { BannerUploadError, processBannerUpload, removeTemporaryBanner } from "../../../../db/temporary-banners";
import { authorizeAdmin } from "../authorize";

export async function GET(){
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  return NextResponse.json({banners:await loadBanners(true)});
}

export async function POST(request:NextRequest){
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  let temporaryPath:string|undefined;
  try{
    const form=await request.formData(),file=form.get("file"),alt=String(form.get("alt")||"Vape Mart promotion").trim().slice(0,180);
    const headline=String(form.get("headline")||"").trim().slice(0,120),subtitle=String(form.get("subtitle")||"").trim().slice(0,240),label=String(form.get("label")||"").trim().slice(0,60),ctaText=String(form.get("ctaText")||"").trim().slice(0,60),ctaUrl=String(form.get("ctaUrl")||"/#catalogue").trim().slice(0,300);
    const replaceId=String(form.get("replaceId")||"").trim();
    if(!(file instanceof File))return NextResponse.json({error:"The uploaded file is not a valid image."},{status:400});
    const db=await ensureDatabase();
    const count=await db.prepare("SELECT COUNT(*)::int AS count FROM banners WHERE image_status IN ('temporary','pending_deployment','archiving','archived_verified')").first<{count:number}>();
    if((count?.count||0)>=6)return NextResponse.json({error:"A maximum of six hero banners is allowed."},{status:400});
    const replacement=replaceId?await db.prepare("SELECT id FROM banners WHERE id=? AND image_status='missing'").bind(replaceId).first<{id:string}>():null;
    if(replaceId&&!replacement)return NextResponse.json({error:"The missing banner could not be found."},{status:404});
    const id=replacement?.id||crypto.randomUUID(),now=new Date().toISOString();
    const temporary=await processBannerUpload(file,id);
    temporaryPath=temporary.filePath;
    if(replacement) {
      await db.prepare(`UPDATE banners SET object_key=?,alt_text=?,headline=?,subtitle=?,label=?,cta_text=?,cta_url=?,original_filename=?,temporary_path=?,public_url=?,
        image_status='temporary',source_type='admin_replacement',github_path=NULL,github_commit_sha=NULL,archived_at=NULL,
        hidden_from_admin=0,dismissed_at=NULL,dismissed_by=NULL,last_failure_reason=NULL,updated_at=? WHERE id=?`)
        .bind(`temporary/${id}.webp`,alt,headline,subtitle,label,ctaText,ctaUrl,temporary.originalFilename,temporary.filePath,temporary.url,now,id).run();
    } else {
      await db.prepare(`INSERT INTO banners
        (id,object_key,alt_text,headline,subtitle,label,cta_text,cta_url,position,created_at,original_filename,temporary_path,public_url,image_status,source_type,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id,`temporary/${id}.webp`,alt,headline,subtitle,label,ctaText,ctaUrl,count?.count||0,now,temporary.originalFilename,temporary.filePath,
          temporary.url,"temporary","admin_upload",now).run();
    }
    return NextResponse.json({ok:true,banners:await loadBanners(true)},{status:201});
  }catch(error){
    if(temporaryPath)await removeTemporaryBanner(temporaryPath);
    console.error("banner_upload_failed",error);
    if(error instanceof BannerUploadError)return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({error:"Image processing failed."},{status:500});
  }
}
