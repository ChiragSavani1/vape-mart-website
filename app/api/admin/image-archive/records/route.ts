import { NextResponse } from "next/server";
import { getAdminSession } from "../../../../../db/auth";
import { loadImageWorkflow } from "../../../../../db/image-workflow";
import { ensureDatabase } from "../../../../../db/runtime";
import { authorizeAdmin } from "../../authorize";

type CleanupRequest={action?:"dismiss"|"restore"|"dismiss_all_verified";entityType?:"product"|"banner";recordId?:string};

export async function POST(request:Request) {
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  const session=await getAdminSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
    const body=await request.json().catch(()=>({})) as CleanupRequest;
    const db=await ensureDatabase();
    const now=new Date().toISOString();
    let changed=0;
    if(body.action==="dismiss_all_verified") {
      const results=await db.batch([
        db.prepare(`UPDATE product_image_states SET hidden_from_admin=1,dismissed_at=?,dismissed_by=?,updated_at=?
          WHERE status='archived_verified' AND hidden_from_admin=0`).bind(now,session.email,now),
        db.prepare(`UPDATE banners SET hidden_from_admin=1,dismissed_at=?,dismissed_by=?,updated_at=?
          WHERE image_status='archived_verified' AND hidden_from_admin=0`).bind(now,session.email,now),
      ]);
      changed=results.reduce((total,result)=>total+Number(result.meta.changes||0),0);
    } else {
      if(!body.recordId||!["product","banner"].includes(String(body.entityType))) {
        return NextResponse.json({error:"Choose an archived image record."},{status:400});
      }
      const dismiss=body.action==="dismiss";
      const restore=body.action==="restore";
      if(!dismiss&&!restore)return NextResponse.json({error:"Unsupported archive-list action."},{status:400});
      const table=body.entityType==="banner"?"banners":"product_image_states";
      const idColumn=body.entityType==="banner"?"id":"product_id";
      const statusColumn=body.entityType==="banner"?"image_status":"status";
      const result=dismiss
        ?await db.prepare(`UPDATE ${table} SET hidden_from_admin=1,dismissed_at=?,dismissed_by=?,updated_at=?
          WHERE ${idColumn}=? AND ${statusColumn}='archived_verified' AND hidden_from_admin=0`)
          .bind(now,session.email,now,body.recordId).run()
        :await db.prepare(`UPDATE ${table} SET hidden_from_admin=0,dismissed_at=NULL,dismissed_by=NULL,updated_at=?
          WHERE ${idColumn}=? AND ${statusColumn}='archived_verified' AND hidden_from_admin=1`)
          .bind(now,body.recordId).run();
      changed=Number(result.meta.changes||0);
    }
    if(!changed)return NextResponse.json({error:"Only verified archived images can be changed."},{status:409});
    return NextResponse.json({ok:true,changed,items:await loadImageWorkflow()});
  } catch(error) {
    console.error("archive_record_cleanup_failed",error);
    return NextResponse.json({error:"The archive list could not be updated."},{status:500});
  }
}
