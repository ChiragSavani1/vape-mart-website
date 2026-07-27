import { NextResponse } from "next/server";
import { getObject } from "../../../../db/storage";

export async function GET(_:Request,{params}:{params:Promise<{key:string[]}>}){
  const {key}=await params;
  const object=await getObject(key.join("/"));
  if(!object)return NextResponse.json({error:"Asset not found"},{status:404});
  const headers=new Headers();
  headers.set("content-type",object.contentType);
  if(object.etag)headers.set("etag",object.etag);
  headers.set("cache-control","public, max-age=31536000, immutable");
  return new Response(object.body.buffer.slice(object.body.byteOffset,object.body.byteOffset+object.body.byteLength) as ArrayBuffer,{headers});
}
