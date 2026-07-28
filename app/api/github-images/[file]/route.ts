import { NextResponse } from "next/server";

function contentType(fileName:string) {
  if(fileName.endsWith(".png"))return "image/png";
  if(fileName.endsWith(".webp"))return "image/webp";
  if(fileName.endsWith(".avif"))return "image/avif";
  return "image/jpeg";
}

export async function GET(_:Request,{params}:{params:Promise<{file:string}>}) {
  const {file}=await params;
  if(file!==file.replace(/[^a-z0-9._-]/gi,""))return NextResponse.json({error:"Invalid image."},{status:400});
  const token=process.env.GITHUB_IMAGE_ARCHIVE_TOKEN;
  const repository=process.env.GITHUB_IMAGE_ARCHIVE_REPOSITORY;
  const branch=process.env.GITHUB_IMAGE_ARCHIVE_BRANCH;
  if(!token||!repository||!branch)return NextResponse.json({error:"Image archive is unavailable."},{status:404});
  const repositoryPath=file.startsWith("banner-")?`public/banners/${file}`:`public/products/archived/${file}`;
  const response=await fetch(`https://api.github.com/repos/${repository}/contents/${repositoryPath}?ref=${encodeURIComponent(branch)}`,{
    headers:{accept:"application/vnd.github.raw+json",authorization:`Bearer ${token}`,"x-github-api-version":"2022-11-28"},
    next:{revalidate:3600},
  });
  if(!response.ok)return NextResponse.json({error:"Archived image not found."},{status:404});
  return new Response(await response.arrayBuffer(),{headers:{"content-type":contentType(file),"cache-control":"public, max-age=3600, stale-while-revalidate=86400"}});
}
