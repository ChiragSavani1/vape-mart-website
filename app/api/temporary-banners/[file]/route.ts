import { NextResponse } from "next/server";
import { markMissingBannerByTemporaryFile } from "../../../../db/image-workflow";
import { readTemporaryBanner } from "../../../../db/temporary-banners";

export async function GET(_:Request,{params}:{params:Promise<{file:string}>}) {
  const {file}=await params;
  const object=await readTemporaryBanner(file);
  if(!object) {
    await markMissingBannerByTemporaryFile(file).catch(error=>console.error("temporary_banner_recovery_failed",error));
    return NextResponse.json({error:"Temporary banner is unavailable."},{status:404,headers:{"cache-control":"no-store"}});
  }
  return new Response(object.body.buffer.slice(object.body.byteOffset,object.body.byteOffset+object.body.byteLength) as ArrayBuffer,{
    headers:{"content-type":"image/webp","cache-control":"no-store"},
  });
}
