import { NextResponse } from "next/server";
import { loadImageWorkflow } from "../../../../db/image-workflow";
import { authorizeAdmin } from "../authorize";

export async function GET() {
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  return NextResponse.json({items:await loadImageWorkflow()});
}
