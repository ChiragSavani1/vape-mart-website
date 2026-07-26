import { NextResponse } from "next/server";
import { getStorage } from "../../../../db/runtime";

export async function GET(_:Request,{params}:{params:Promise<{key:string[]}>}){
  const {key}=await params;
  const object=await getStorage().get(key.join("/"));
  if(!object)return NextResponse.json({error:"Asset not found"},{status:404});
  const headers=new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag",object.httpEtag);
  headers.set("cache-control","public, max-age=3600");
  return new Response(object.body,{headers});
}
