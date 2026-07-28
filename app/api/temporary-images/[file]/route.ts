import { NextResponse } from "next/server";
import { markMissingByTemporaryFile } from "../../../../db/image-workflow";
import { readTemporaryProductImage } from "../../../../db/temporary-images";

function contentType(fileName:string) {
  if(fileName.endsWith(".png"))return "image/png";
  if(fileName.endsWith(".webp"))return "image/webp";
  if(fileName.endsWith(".avif"))return "image/avif";
  return "image/jpeg";
}

export async function GET(_:Request,{params}:{params:Promise<{file:string}>}) {
  const {file}=await params;
  const object=await readTemporaryProductImage(file);
  if(!object) {
    await markMissingByTemporaryFile(file).catch(error=>console.error("temporary_image_recovery_failed",error));
    return NextResponse.json({error:"Temporary image is being recovered."},{status:404,headers:{"cache-control":"no-store"}});
  }
  return new Response(object.body.buffer.slice(object.body.byteOffset,object.body.byteOffset+object.body.byteLength) as ArrayBuffer,{
    headers:{"content-type":contentType(file),"cache-control":"no-store"},
  });
}
