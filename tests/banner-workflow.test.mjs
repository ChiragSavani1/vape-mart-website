import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

const root=new URL("../",import.meta.url);
const {BANNER_UPLOAD_LIMIT,processBannerUpload,readTemporaryBanner}=await import("../db/temporary-banners.ts");

function upload(name,type,bytes,size=bytes.byteLength) {
  return {name,type,size,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
}

async function sourceImage(format) {
  const image=sharp({create:{width:1600,height:600,channels:3,background:"#111111"}});
  return format==="png"?image.png().toBuffer():format==="jpeg"?image.jpeg().toBuffer():image.webp().toBuffer();
}

for(const [format,mime,extension] of [["png","image/png","png"],["jpeg","image/jpeg","jpg"],["webp","image/webp","webp"]]) {
  test(`${format.toUpperCase()} hero banner is validated and stored as optimized WebP`,async()=>{
    const directory=await mkdtemp(path.join(os.tmpdir(),"vape-mart-banner-test-"));
    try{
      const bytes=await sourceImage(format);
      const saved=await processBannerUpload(upload(`promotion.${extension}`,mime,bytes),"banner-test",path.join(directory,"missing","banners"));
      assert.equal(saved.contentType,"image/webp");
      assert.match(saved.filePath,/\.webp$/);
      assert.match(saved.url,/^\/api\/temporary-banners\//);
      const stored=await readFile(saved.filePath);
      assert.equal((await sharp(stored).metadata()).format,"webp");
    }finally{await rm(directory,{recursive:true,force:true})}
  });
}

test("oversized and corrupted banner files are rejected with safe messages",async()=>{
  const tiny=Buffer.from("not-an-image");
  await assert.rejects(
    processBannerUpload(upload("too-large.png","image/png",tiny,BANNER_UPLOAD_LIMIT+1),"oversized"),
    /File exceeds the upload size limit/,
  );
  await assert.rejects(
    processBannerUpload(upload("corrupt.png","image/png",tiny),"corrupt"),
    /not a valid image/,
  );
});

test("banner temporary route, GitHub verification, fallback, and cleanup remain independent of S3",async()=>{
  const [bannerApi,tempRoute,archiveRoute,cleanupRoute,assets,catalogue,storefront,schema,dashboard]=await Promise.all([
    readFile(new URL("app/api/admin/banners/route.ts",root),"utf8"),
    readFile(new URL("app/api/temporary-banners/[file]/route.ts",root),"utf8"),
    readFile(new URL("app/api/admin/image-archive/route.ts",root),"utf8"),
    readFile(new URL("app/api/admin/image-archive/records/route.ts",root),"utf8"),
    readFile(new URL("db/assets.ts",root),"utf8"),
    readFile(new URL("db/catalog.ts",root),"utf8"),
    readFile(new URL("app/storefront.tsx",root),"utf8"),
    readFile(new URL("db/schema.ts",root),"utf8"),
    readFile(new URL("app/admin/dashboard.tsx",root),"utf8"),
  ]);
  assert.match(bannerApi,/processBannerUpload/);
  assert.doesNotMatch(bannerApi,/putObject|S3_|db\/storage/);
  assert.match(bannerApi,/image_status='missing'/);
  assert.match(tempRoute,/markMissingBannerByTemporaryFile/);
  assert.match(assets,/public_url IS NOT NULL/);
  assert.match(assets,/reconcileTemporaryBanners/);
  assert.match(storefront,/failedBanners/);
  assert.match(storefront,/availableBanners\.length\?availableBanners:defaultArrivalBanners/);
  assert.match(archiveRoute,/public\/banners/);
  assert.match(archiveRoute,/verifiedBody\?\.sha!==uploadedBody\.content\.sha/);
  assert.match(archiveRoute,/completeBannerArchive/);
  assert.match(schema,/githubCommitSha/);
  assert.match(schema,/hiddenFromAdmin/);
  assert.match(cleanupRoute,/status='archived_verified'/);
  assert.match(cleanupRoute,/image_status='archived_verified'/);
  assert.match(cleanupRoute,/hidden_from_admin=1,dismissed_at=\?,dismissed_by=\?/);
  assert.match(cleanupRoute,/hidden_from_admin=0,dismissed_at=NULL,dismissed_by=NULL/);
  assert.match(cleanupRoute,/session\.email/);
  assert.doesNotMatch(cleanupRoute,/DELETE FROM|github_path=NULL|public_url=NULL|image_key=NULL|SET public_url|SET image_key/);
  assert.doesNotMatch(assets,/hidden_from_admin/);
  assert.doesNotMatch(catalogue,/hidden_from_admin/);
  assert.match(dashboard,/Remove from Archive List/);
  assert.match(dashboard,/Restore to Archive List/);
  assert.match(dashboard,/Clear Verified Images from List/);
  assert.match(dashboard,/permanent GitHub image and product\/banner will not be deleted/);
});
