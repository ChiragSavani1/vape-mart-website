import path from "node:path";
import { NextResponse } from "next/server";
import {
  completeBannerArchive,
  completeImageArchive,
  loadImageWorkflow,
  markBannerMissing,
  markBannerPending,
  markImageArchiving,
  markImageMissing,
  restoreTemporaryAfterArchiveFailure,
  restoreTemporaryBannerAfterArchiveFailure,
  type ImageWorkflowItem,
} from "../../../../db/image-workflow";
import { readTemporaryBanner, removeTemporaryBanner } from "../../../../db/temporary-banners";
import { readTemporaryProductImage, removeTemporaryProductImage } from "../../../../db/temporary-images";
import { authorizeAdmin } from "../authorize";

const ARCHIVE_BATCH_SIZE=25;

function configuration() {
  const token=process.env.GITHUB_IMAGE_ARCHIVE_TOKEN;
  const repository=process.env.GITHUB_IMAGE_ARCHIVE_REPOSITORY;
  const branch=process.env.GITHUB_IMAGE_ARCHIVE_BRANCH;
  if(!token||!repository||!branch)throw new Error("GitHub image archive is not configured.");
  return {token,repository,branch};
}

function archiveTarget(item:ImageWorkflowItem) {
  if(item.entityType==="banner") {
    const name=`banner-${item.bannerId.replace(/[^a-z0-9_-]/gi,"-")}.webp`;
    return {name,repositoryPath:`public/banners/${name}`,message:`Archive hero banner ${item.bannerId}`};
  }
  const extension=path.extname(item.temporaryPath).toLowerCase()||".jpg";
  const identity=(item.upc||item.productId).replace(/[^a-z0-9_-]/gi,"-");
  const name=`${identity}-${item.productId.replace(/[^a-z0-9_-]/gi,"-").slice(-12)}${extension}`;
  return {name,repositoryPath:`public/products/archived/${name}`,message:`Archive product image ${item.upc}`};
}

async function githubRequest(url:string,token:string,init?:RequestInit) {
  return fetch(url,{
    ...init,
    headers:{
      accept:"application/vnd.github+json",authorization:`Bearer ${token}`,"x-github-api-version":"2022-11-28",
      ...(init?.headers||{}),
    },
    cache:"no-store",
  });
}

async function ensureArchiveBranch(repository:string,branch:string,token:string) {
  const repositoryResponse=await githubRequest(`https://api.github.com/repos/${repository}`,token);
  if(!repositoryResponse.ok)throw new Error("GitHub repository access could not be verified.");
  const repositoryData=await repositoryResponse.json() as {default_branch?:string};
  const defaultBranch=repositoryData.default_branch;
  if(!defaultBranch)throw new Error("GitHub did not return the repository's default branch.");
  if(branch===defaultBranch)throw new Error("Configure a dedicated image archive branch; the default branch will not be modified.");
  const branchRef=`https://api.github.com/repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`;
  const existing=await githubRequest(branchRef,token);
  if(existing.ok)return;
  if(existing.status!==404)throw new Error("GitHub could not verify the image archive branch.");
  const source=await githubRequest(`https://api.github.com/repos/${repository}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,token);
  if(!source.ok)throw new Error("GitHub could not read the default branch reference.");
  const sourceData=await source.json() as {object?:{sha?:string}};
  if(!sourceData.object?.sha)throw new Error("GitHub did not return a source commit for the archive branch.");
  const created=await githubRequest(`https://api.github.com/repos/${repository}/git/refs`,token,{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({ref:`refs/heads/${branch}`,sha:sourceData.object.sha}),
  });
  if(!created.ok)throw new Error("GitHub could not create the dedicated image archive branch.");
}

async function readTemporary(item:ImageWorkflowItem) {
  return item.entityType==="banner"
    ?readTemporaryBanner(path.basename(item.temporaryPath))
    :readTemporaryProductImage(path.basename(item.temporaryPath));
}

async function markMissing(item:ImageWorkflowItem) {
  if(item.entityType==="banner")await markBannerMissing(item.bannerId,"Temporary banner file disappeared before it could be archived.");
  else await markImageMissing(item.productId,"Temporary image file disappeared before it could be archived.",item.previousSourceUrl);
}

async function markPending(item:ImageWorkflowItem) {
  if(item.entityType==="banner")await markBannerPending(item.bannerId);
  else await markImageArchiving(item.productId);
}

async function restoreTemporary(item:ImageWorkflowItem,reason:string) {
  if(item.entityType==="banner")await restoreTemporaryBannerAfterArchiveFailure(item.bannerId,reason);
  else await restoreTemporaryAfterArchiveFailure(item.productId,reason);
}

async function removeTemporary(item:ImageWorkflowItem) {
  if(item.entityType==="banner")await removeTemporaryBanner(item.temporaryPath);
  else await removeTemporaryProductImage(item.temporaryPath);
}

export async function POST() {
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
    const {token,repository,branch}=configuration();
    await ensureArchiveBranch(repository,branch,token);
    const temporary=(await loadImageWorkflow()).filter(item=>item.status==="temporary").slice(0,ARCHIVE_BATCH_SIZE);
    let archived=0,missing=0,failed=0;
    for(const item of temporary) {
      const file=await readTemporary(item);
      if(!file) {
        await markMissing(item);
        missing++;
        continue;
      }
      await markPending(item);
      try {
        const target=archiveTarget(item);
        const apiUrl=`https://api.github.com/repos/${repository}/contents/${target.repositoryPath}`;
        const existing=await githubRequest(`${apiUrl}?ref=${encodeURIComponent(branch)}`,token);
        const existingBody=existing.ok?await existing.json() as {sha?:string}:null;
        if(!existing.ok&&existing.status!==404)throw new Error(`GitHub could not inspect the archive path (${existing.status}).`);
        const uploaded=await githubRequest(apiUrl,token,{
          method:"PUT",headers:{"content-type":"application/json"},
          body:JSON.stringify({
            message:target.message,content:file.body.toString("base64"),branch,
            ...(existingBody?.sha?{sha:existingBody.sha}:{}),
          }),
        });
        if(!uploaded.ok)throw new Error(`GitHub rejected the image archive (${uploaded.status}).`);
        const uploadedBody=await uploaded.json() as {content?:{sha?:string};commit?:{sha?:string}};
        if(!uploadedBody.content?.sha||!uploadedBody.commit?.sha)throw new Error("GitHub did not confirm the archived image.");
        const verified=await githubRequest(`${apiUrl}?ref=${encodeURIComponent(branch)}`,token);
        const verifiedBody=verified.ok?await verified.json() as {sha?:string}:null;
        if(!verified.ok||verifiedBody?.sha!==uploadedBody.content.sha)throw new Error("The GitHub image could not be verified after upload.");
        const imageUrl=`/api/github-images/${encodeURIComponent(target.name)}`;
        if(item.entityType==="banner")await completeBannerArchive(item.bannerId,imageUrl,target.repositoryPath,uploadedBody.commit.sha);
        else await completeImageArchive(item.productId,imageUrl,target.repositoryPath,uploadedBody.commit.sha);
        await removeTemporary(item);
        archived++;
      } catch(error) {
        const reason=error instanceof Error?error.message:"The image could not be archived.";
        await restoreTemporary(item,reason);
        failed++;
      }
    }
    const remaining=(await loadImageWorkflow()).filter(item=>item.status==="temporary").length;
    return NextResponse.json({archived,missing,failed,processed:temporary.length,remaining});
  } catch(error) {
    console.error("github_image_archive_failed",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Images could not be archived."},{status:500});
  }
}
