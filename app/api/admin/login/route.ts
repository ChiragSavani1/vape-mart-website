import { NextResponse } from "next/server";
import { checkLoginRateLimit, createAdminSession, loginIpHash, recordLoginAttempt, verifyAdminCredentials } from "../../../../db/auth";
export async function POST(request:Request){
  const ipHash=await loginIpHash();
  if(!await checkLoginRateLimit(ipHash))return NextResponse.json({error:"Too many attempts. Try again in 15 minutes."},{status:429});
  const body=await request.json().catch(()=>({})) as {email?:string;password?:string};
  const valid=await verifyAdminCredentials(body.email||"",body.password||"");
  await recordLoginAttempt(ipHash,valid);
  if(!valid)return NextResponse.json({error:"Invalid email or password."},{status:401});
  await createAdminSession(body.email||"");
  return NextResponse.json({ok:true});
}
