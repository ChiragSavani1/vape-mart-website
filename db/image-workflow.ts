import { ensureDatabase } from "./runtime";
import { temporaryProductImageExists } from "./temporary-images";

export type ImageWorkflowStatus="missing"|"temporary"|"archiving"|"archived";
export type ImageWorkflowItem={
  productId:string;
  name:string;
  brand:string;
  sku:string;
  upc:string;
  image?:string;
  status:ImageWorkflowStatus;
  previousSourceUrl:string;
  temporaryPath:string;
  archivedUrl:string;
  retryCount:number;
  lastSearchAt:string;
  lastFailureReason:string;
};
type StateRow={
  product_id:string;status:ImageWorkflowStatus;sku:string|null;upc:string;previous_source_url:string|null;
  temporary_path:string|null;archived_url:string|null;retry_count:number;retry_requested:number;
  last_search_at:string|null;last_failure_reason:string|null;updated_at:string;
};

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
    (product_id,status,sku,upc,previous_source_url,temporary_path,retry_count,retry_requested,last_search_at,last_failure_reason,updated_at)
    VALUES (?,?,?,?,?,?,1,0,?,NULL,?)
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
      status='missing',
      previous_source_url=COALESCE(?,previous_source_url),
      temporary_path=NULL,
      retry_requested=0,
      last_failure_reason=?,
      updated_at=?
      WHERE product_id=?`).bind(previousSourceUrl||null,reason,now,productId),
    db.prepare("UPDATE products SET image_key=NULL,updated_at=? WHERE id=?").bind(now,productId),
  ]);
}

export async function recordImageSearchFailure(product:{id:string;upc:string},reason:string,sourceUrl?:string|null,sku?:string) {
  const db=await ensureDatabase();
  const now=new Date().toISOString();
  await db.prepare(`INSERT INTO product_image_states
    (product_id,status,sku,upc,previous_source_url,retry_count,retry_requested,last_search_at,last_failure_reason,updated_at)
    VALUES (?,?,?,?,?,1,0,?,?,?)
    ON CONFLICT(product_id) DO UPDATE SET
      status='missing',
      sku=COALESCE(NULLIF(excluded.sku,''),product_image_states.sku),
      upc=excluded.upc,
      previous_source_url=COALESCE(excluded.previous_source_url,product_image_states.previous_source_url),
      temporary_path=NULL,
      retry_count=product_image_states.retry_count+1,
      retry_requested=0,
      last_search_at=excluded.last_search_at,
      last_failure_reason=excluded.last_failure_reason,
      updated_at=excluded.updated_at`)
    .bind(product.id,"missing",sku||null,product.upc,sourceUrl||null,now,reason,now).run();
  await db.prepare("UPDATE products SET image_key=NULL,updated_at=? WHERE id=?").bind(now,product.id).run();
}

export async function requestImageRetry(productId:string) {
  const db=await ensureDatabase();
  await db.prepare("UPDATE product_image_states SET retry_requested=1,last_failure_reason=NULL,updated_at=? WHERE product_id=?")
    .bind(new Date().toISOString(),productId).run();
}

export async function markImageArchiving(productId:string) {
  const db=await ensureDatabase();
  await db.prepare("UPDATE product_image_states SET status='archiving',updated_at=? WHERE product_id=? AND status='temporary'")
    .bind(new Date().toISOString(),productId).run();
}

export async function restoreTemporaryAfterArchiveFailure(productId:string,reason:string) {
  const db=await ensureDatabase();
  await db.prepare("UPDATE product_image_states SET status='temporary',last_failure_reason=?,updated_at=? WHERE product_id=? AND status='archiving'")
    .bind(reason,new Date().toISOString(),productId).run();
}

export async function completeImageArchive(productId:string,imageUrl:string,archivedUrl:string) {
  const db=await ensureDatabase();
  const now=new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE product_image_states SET
      status='archived',temporary_path=NULL,archived_url=?,last_failure_reason=NULL,retry_requested=0,updated_at=?
      WHERE product_id=?`).bind(archivedUrl,now,productId),
    db.prepare("UPDATE products SET image_key=?,updated_at=? WHERE id=?").bind(imageUrl,now,productId),
  ]);
}

export async function reconcileTemporaryImages() {
  const db=await ensureDatabase();
  const rows=await db.prepare("SELECT product_id,status,temporary_path,previous_source_url,updated_at FROM product_image_states WHERE status IN ('temporary','archiving')")
    .all<{product_id:string;status:ImageWorkflowStatus;temporary_path:string|null;previous_source_url:string|null;updated_at:string}>();
  for(const row of rows.results||[]) {
    if(!await temporaryProductImageExists(row.temporary_path)) {
      await markImageMissing(row.product_id,"Temporary image file disappeared from Render storage.",row.previous_source_url);
    } else if(row.status==="archiving"&&Date.parse(row.updated_at)<Date.now()-15*60*1000) {
      await restoreTemporaryAfterArchiveFailure(row.product_id,"A previous archive attempt was interrupted and is ready to retry.");
    }
  }
}

export async function markMissingByTemporaryFile(fileName:string) {
  const db=await ensureDatabase();
  const row=await db.prepare("SELECT product_id,previous_source_url FROM product_image_states WHERE status='temporary' AND temporary_path LIKE ? LIMIT 1")
    .bind(`%/${fileName}`).first<{product_id:string;previous_source_url:string|null}>();
  if(row)await markImageMissing(row.product_id,"Temporary image file disappeared from Render storage.",row.previous_source_url);
}

export async function loadImageWorkflow():Promise<ImageWorkflowItem[]> {
  await reconcileTemporaryImages();
  const db=await ensureDatabase();
  const rows=await db.prepare(`SELECT s.*,p.name,p.brand,p.image_key
    FROM product_image_states s JOIN products p ON p.id=s.product_id
    ORDER BY s.updated_at DESC`)
    .all<StateRow&{name:string;brand:string;image_key:string|null}>();
  return (rows.results||[]).map(row=>({
    productId:row.product_id,name:row.name,brand:row.brand,sku:row.sku||"",upc:row.upc,image:row.image_key||undefined,
    status:row.status,previousSourceUrl:row.previous_source_url||"",temporaryPath:row.temporary_path||"",
    archivedUrl:row.archived_url||"",retryCount:Number(row.retry_count||0),lastSearchAt:row.last_search_at||"",
    lastFailureReason:row.last_failure_reason||"",
  }));
}
