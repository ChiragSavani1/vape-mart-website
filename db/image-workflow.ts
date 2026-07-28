import { ensureDatabase } from "./runtime";
import { temporaryBannerExists } from "./temporary-banners";
import { temporaryProductImageExists } from "./temporary-images";

export type ImageWorkflowStatus="missing"|"temporary"|"pending_deployment"|"archiving"|"archived"|"archived_verified";
export type ImageWorkflowItem={
  recordId:string;
  entityType:"product"|"banner";
  productId:string;
  bannerId:string;
  name:string;
  brand:string;
  sku:string;
  upc:string;
  image?:string;
  status:ImageWorkflowStatus;
  previousSourceUrl:string;
  temporaryPath:string;
  archivedUrl:string;
  githubPath:string;
  githubCommitSha:string;
  githubUrl:string;
  retryCount:number;
  lastSearchAt:string;
  lastFailureReason:string;
  archivedAt:string;
  createdAt:string;
  hiddenFromAdmin:boolean;
  dismissedAt:string;
  dismissedBy:string;
};
type StateRow={
  product_id:string;status:ImageWorkflowStatus;sku:string|null;upc:string;previous_source_url:string|null;
  temporary_path:string|null;archived_url:string|null;retry_count:number;retry_requested:number;
  last_search_at:string|null;last_failure_reason:string|null;github_path:string|null;github_commit_sha:string|null;
  archived_at:string|null;hidden_from_admin:number;dismissed_at:string|null;dismissed_by:string|null;updated_at:string;
};

function githubUrl(path:string) {
  const repository=process.env.GITHUB_IMAGE_ARCHIVE_REPOSITORY;
  const branch=process.env.GITHUB_IMAGE_ARCHIVE_BRANCH;
  return repository&&branch&&path?`https://github.com/${repository}/blob/${encodeURIComponent(branch)}/${path.split("/").map(encodeURIComponent).join("/")}`:"";
}

export async function ensureMissingImageState(product:{id:string;upc:string;image?:string},sku?:string) {
  if(product.image)return;
  const db=await ensureDatabase();
  const now=new Date().toISOString();
  await db.prepare(`INSERT INTO product_image_states
    (product_id,status,sku,upc,retry_count,retry_requested,updated_at)
    VALUES (?,?,?,?,0,0,?)
    ON CONFLICT(product_id) DO UPDATE SET
      sku=COALESCE(NULLIF(excluded.sku,''),product_image_states.sku),
      upc=excluded.upc,
      updated_at=excluded.updated_at`)
    .bind(product.id,"missing",sku||null,product.upc,now).run();
}

export async function markImageTemporary(product:{id:string;upc:string},temporaryPath:string,imageUrl:string,sourceUrl:string,sku?:string) {
  const db=await ensureDatabase();
  const now=new Date().toISOString();
  await db.prepare(`INSERT INTO product_image_states
    (product_id,status,sku,upc,previous_source_url,temporary_path,retry_count,retry_requested,last_search_at,last_failure_reason,hidden_from_admin,dismissed_at,dismissed_by,updated_at)
    VALUES (?,?,?,?,?,?,1,0,?,NULL,0,NULL,NULL,?)
    ON CONFLICT(product_id) DO UPDATE SET
      status='temporary',
      sku=COALESCE(NULLIF(excluded.sku,''),product_image_states.sku),
      upc=excluded.upc,
      previous_source_url=excluded.previous_source_url,
      temporary_path=excluded.temporary_path,
      retry_count=product_image_states.retry_count+1,
      retry_requested=0,
      last_search_at=excluded.last_search_at,
      last_failure_reason=NULL,
      hidden_from_admin=0,
      dismissed_at=NULL,
      dismissed_by=NULL,
      updated_at=excluded.updated_at`)
    .bind(product.id,"temporary",sku||null,product.upc,sourceUrl,temporaryPath,now,now).run();
  await db.prepare("UPDATE products SET image_key=?,manual_image=0,updated_at=? WHERE id=?")
    .bind(imageUrl,now,product.id).run();
}

export async function markImageArchived(product:{id:string;upc:string},imageUrl:string,sourceUrl:string,sku?:string) {
  const db=await ensureDatabase();
  const now=new Date().toISOString();
  await db.prepare(`INSERT INTO product_image_states
    (product_id,status,sku,upc,previous_source_url,archived_url,retry_count,retry_requested,last_search_at,last_failure_reason,updated_at)
    VALUES (?,?,?,?,?,?,1,0,?,NULL,?)
    ON CONFLICT(product_id) DO UPDATE SET
      status='archived',
      sku=COALESCE(NULLIF(excluded.sku,''),product_image_states.sku),
      upc=excluded.upc,
      previous_source_url=excluded.previous_source_url,
      temporary_path=NULL,
      archived_url=excluded.archived_url,
      retry_requested=0,
      last_search_at=excluded.last_search_at,
      last_failure_reason=NULL,
      updated_at=excluded.updated_at`)
    .bind(product.id,"archived",sku||null,product.upc,sourceUrl,imageUrl,now,now).run();
  await db.prepare("UPDATE products SET image_key=?,manual_image=0,updated_at=? WHERE id=?")
    .bind(imageUrl,now,product.id).run();
}

export async function markImageMissing(productId:string,reason:string,previousSourceUrl?:string|null) {
  const db=await ensureDatabase();
  const now=new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE product_image_states SET
      status='missing',previous_source_url=COALESCE(?,previous_source_url),temporary_path=NULL,
      retry_requested=0,last_failure_reason=?,hidden_from_admin=0,dismissed_at=NULL,dismissed_by=NULL,updated_at=?
      WHERE product_id=?`).bind(previousSourceUrl||null,reason,now,productId),
    db.prepare("UPDATE products SET image_key=NULL,updated_at=? WHERE id=?").bind(now,productId),
  ]);
}

export async function recordImageSearchFailure(product:{id:string;upc:string},reason:string,sourceUrl?:string|null,sku?:string) {
  const db=await ensureDatabase();
  const now=new Date().toISOString();
  await db.prepare(`INSERT INTO product_image_states
    (product_id,status,sku,upc,previous_source_url,retry_count,retry_requested,last_search_at,last_failure_reason,hidden_from_admin,updated_at)
    VALUES (?,?,?,?,?,1,0,?,?,0,?)
    ON CONFLICT(product_id) DO UPDATE SET
      status='missing',sku=COALESCE(NULLIF(excluded.sku,''),product_image_states.sku),upc=excluded.upc,
      previous_source_url=COALESCE(excluded.previous_source_url,product_image_states.previous_source_url),
      temporary_path=NULL,retry_count=product_image_states.retry_count+1,retry_requested=0,
      last_search_at=excluded.last_search_at,last_failure_reason=excluded.last_failure_reason,
      hidden_from_admin=0,dismissed_at=NULL,dismissed_by=NULL,updated_at=excluded.updated_at`)
    .bind(product.id,"missing",sku||null,product.upc,sourceUrl||null,now,reason,now).run();
  await db.prepare("UPDATE products SET image_key=NULL,updated_at=? WHERE id=?").bind(now,product.id).run();
}

export async function requestImageRetry(productId:string) {
  const db=await ensureDatabase();
  await db.prepare("UPDATE product_image_states SET retry_requested=1,last_failure_reason=NULL,hidden_from_admin=0,updated_at=? WHERE product_id=? AND status='missing'")
    .bind(new Date().toISOString(),productId).run();
}

export async function markImageArchiving(productId:string) {
  const db=await ensureDatabase();
  await db.prepare("UPDATE product_image_states SET status='pending_deployment',updated_at=? WHERE product_id=? AND status='temporary'")
    .bind(new Date().toISOString(),productId).run();
}

export async function restoreTemporaryAfterArchiveFailure(productId:string,reason:string) {
  const db=await ensureDatabase();
  await db.prepare("UPDATE product_image_states SET status='temporary',last_failure_reason=?,updated_at=? WHERE product_id=? AND status IN ('pending_deployment','archiving')")
    .bind(reason,new Date().toISOString(),productId).run();
}

export async function completeImageArchive(productId:string,imageUrl:string,githubPath:string,commitSha:string) {
  const db=await ensureDatabase();
  const now=new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE product_image_states SET
      status='archived_verified',temporary_path=NULL,archived_url=?,github_path=?,github_commit_sha=?,
      archived_at=?,last_failure_reason=NULL,retry_requested=0,hidden_from_admin=0,dismissed_at=NULL,dismissed_by=NULL,updated_at=?
      WHERE product_id=?`).bind(imageUrl,githubPath,commitSha,now,now,productId),
    db.prepare("UPDATE products SET image_key=?,updated_at=? WHERE id=?").bind(imageUrl,now,productId),
  ]);
}

export async function markBannerPending(bannerId:string) {
  const db=await ensureDatabase();
  await db.prepare("UPDATE banners SET image_status='pending_deployment',updated_at=? WHERE id=? AND image_status='temporary'")
    .bind(new Date().toISOString(),bannerId).run();
}

export async function restoreTemporaryBannerAfterArchiveFailure(bannerId:string,reason:string) {
  const db=await ensureDatabase();
  await db.prepare("UPDATE banners SET image_status='temporary',last_failure_reason=?,updated_at=? WHERE id=? AND image_status IN ('pending_deployment','archiving')")
    .bind(reason,new Date().toISOString(),bannerId).run();
}

export async function markBannerMissing(bannerId:string,reason:string) {
  const db=await ensureDatabase();
  await db.prepare(`UPDATE banners SET image_status='missing',temporary_path=NULL,public_url=NULL,
    last_failure_reason=?,hidden_from_admin=0,dismissed_at=NULL,dismissed_by=NULL,updated_at=? WHERE id=?`)
    .bind(reason,new Date().toISOString(),bannerId).run();
}

export async function completeBannerArchive(bannerId:string,imageUrl:string,githubPath:string,commitSha:string) {
  const db=await ensureDatabase();
  const now=new Date().toISOString();
  await db.prepare(`UPDATE banners SET image_status='archived_verified',temporary_path=NULL,public_url=?,
    object_key=?,github_path=?,github_commit_sha=?,archived_at=?,last_failure_reason=NULL,
    hidden_from_admin=0,dismissed_at=NULL,dismissed_by=NULL,updated_at=? WHERE id=?`)
    .bind(imageUrl,githubPath,githubPath,commitSha,now,now,bannerId).run();
}

export async function reconcileTemporaryImages() {
  const db=await ensureDatabase();
  const rows=await db.prepare(`SELECT product_id,status,temporary_path,previous_source_url,updated_at
    FROM product_image_states WHERE status IN ('temporary','pending_deployment','archiving')`)
    .all<{product_id:string;status:ImageWorkflowStatus;temporary_path:string|null;previous_source_url:string|null;updated_at:string}>();
  for(const row of rows.results||[]) {
    if(!await temporaryProductImageExists(row.temporary_path)) {
      await markImageMissing(row.product_id,"Temporary image file disappeared from Render storage.",row.previous_source_url);
    } else if(["pending_deployment","archiving"].includes(row.status)&&Date.parse(row.updated_at)<Date.now()-15*60*1000) {
      await restoreTemporaryAfterArchiveFailure(row.product_id,"A previous archive attempt was interrupted and is ready to retry.");
    }
  }
}

export async function reconcileTemporaryBanners() {
  const db=await ensureDatabase();
  const rows=await db.prepare(`SELECT id,image_status,temporary_path,updated_at FROM banners
    WHERE image_status IN ('temporary','pending_deployment','archiving')`)
    .all<{id:string;image_status:ImageWorkflowStatus;temporary_path:string|null;updated_at:string|null}>();
  for(const row of rows.results||[]) {
    if(!await temporaryBannerExists(row.temporary_path)) {
      await markBannerMissing(row.id,"Temporary banner file disappeared from Render storage.");
    } else if(["pending_deployment","archiving"].includes(row.image_status)&&row.updated_at&&Date.parse(row.updated_at)<Date.now()-15*60*1000) {
      await restoreTemporaryBannerAfterArchiveFailure(row.id,"A previous banner archive attempt was interrupted and is ready to retry.");
    }
  }
}

export async function markMissingByTemporaryFile(fileName:string) {
  const db=await ensureDatabase();
  const row=await db.prepare("SELECT product_id,previous_source_url FROM product_image_states WHERE status IN ('temporary','pending_deployment') AND temporary_path LIKE ? LIMIT 1")
    .bind(`%/${fileName}`).first<{product_id:string;previous_source_url:string|null}>();
  if(row)await markImageMissing(row.product_id,"Temporary image file disappeared from Render storage.",row.previous_source_url);
}

export async function markMissingBannerByTemporaryFile(fileName:string) {
  const db=await ensureDatabase();
  const row=await db.prepare("SELECT id FROM banners WHERE image_status IN ('temporary','pending_deployment') AND temporary_path LIKE ? LIMIT 1")
    .bind(`%/${fileName}`).first<{id:string}>();
  if(row)await markBannerMissing(row.id,"Temporary banner file disappeared from Render storage.");
}

export async function loadImageWorkflow():Promise<ImageWorkflowItem[]> {
  await Promise.all([reconcileTemporaryImages(),reconcileTemporaryBanners()]);
  const db=await ensureDatabase();
  const [productRows,bannerRows]=await Promise.all([
    db.prepare(`SELECT s.*,p.name,p.brand,p.image_key,p.updated_at AS product_created_at
      FROM product_image_states s JOIN products p ON p.id=s.product_id ORDER BY s.updated_at DESC`)
      .all<StateRow&{name:string;brand:string;image_key:string|null;product_created_at:string}>(),
    db.prepare(`SELECT id,alt_text,public_url,image_status,original_filename,temporary_path,github_path,
      github_commit_sha,archived_at,hidden_from_admin,dismissed_at,dismissed_by,last_failure_reason,created_at
      FROM banners ORDER BY COALESCE(updated_at,created_at) DESC`)
      .all<{id:string;alt_text:string;public_url:string|null;image_status:ImageWorkflowStatus;original_filename:string|null;
        temporary_path:string|null;github_path:string|null;github_commit_sha:string|null;archived_at:string|null;
        hidden_from_admin:number;dismissed_at:string|null;dismissed_by:string|null;last_failure_reason:string|null;created_at:string}>(),
  ]);
  const products=(productRows.results||[]).map(row=>({
    recordId:row.product_id,entityType:"product" as const,productId:row.product_id,bannerId:"",
    name:row.name,brand:row.brand,sku:row.sku||"",upc:row.upc,image:row.image_key||undefined,
    status:row.status,previousSourceUrl:row.previous_source_url||"",temporaryPath:row.temporary_path||"",
    archivedUrl:row.archived_url||"",githubPath:row.github_path||"",githubCommitSha:row.github_commit_sha||"",
    githubUrl:githubUrl(row.github_path||""),retryCount:Number(row.retry_count||0),lastSearchAt:row.last_search_at||"",
    lastFailureReason:row.last_failure_reason||"",archivedAt:row.archived_at||"",createdAt:row.product_created_at||"",
    hiddenFromAdmin:Boolean(row.hidden_from_admin),dismissedAt:row.dismissed_at||"",dismissedBy:row.dismissed_by||"",
  }));
  const banners=(bannerRows.results||[]).map(row=>({
    recordId:row.id,entityType:"banner" as const,productId:"",bannerId:row.id,name:row.alt_text,brand:"Hero banner",
    sku:"",upc:"",image:row.public_url||undefined,status:row.image_status,
    previousSourceUrl:row.original_filename||"",temporaryPath:row.temporary_path||"",archivedUrl:row.public_url||"",
    githubPath:row.github_path||"",githubCommitSha:row.github_commit_sha||"",githubUrl:githubUrl(row.github_path||""),
    retryCount:0,lastSearchAt:"",lastFailureReason:row.last_failure_reason||"",archivedAt:row.archived_at||"",
    createdAt:row.created_at,hiddenFromAdmin:Boolean(row.hidden_from_admin),dismissedAt:row.dismissed_at||"",
    dismissedBy:row.dismissed_by||"",
  }));
  return [...products,...banners].sort((a,b)=>(b.archivedAt||b.createdAt).localeCompare(a.archivedAt||a.createdAt));
}
