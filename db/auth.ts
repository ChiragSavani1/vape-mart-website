import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { compare } from "bcryptjs";
import { cookies, headers } from "next/headers";
import { ensureDatabase, sha256 } from "./runtime";

const COOKIE="vapemart_admin_session",MAX_AGE=60*60*12;
const dummy="$2b$12$C6UzMDM.H6dfI/f/IKxGhu3kB5W4Q8fP6wY0Y0jQ2l7sQyqI6oL5e";
function secret(){const value=process.env.SESSION_SECRET;if(!value||value.length<32)throw new Error("SESSION_SECRET must contain at least 32 characters.");return value;}
function tokenHash(token:string){return createHmac("sha256",secret()).update(token).digest("hex");}
export async function getAdminSession(){
  const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;
  const db=await ensureDatabase(),now=new Date().toISOString();
  const session=await db.prepare("SELECT id,email,expires_at FROM admin_sessions WHERE token_hash=? AND expires_at>?").bind(tokenHash(token),now).first<{id:string;email:string;expires_at:string}>();
  return session?{id:session.id,email:session.email}:null;
}
export async function loginIpHash(){
  const h=await headers(),ip=(h.get("x-forwarded-for")||h.get("x-real-ip")||"unknown").split(",")[0].trim();
  return sha256(`${process.env.RATE_LIMIT_SALT||secret()}:${ip}`);
}
export async function verifyAdminCredentials(email:string,password:string){
  const expected=(process.env.ADMIN_EMAIL||"").trim().toLowerCase(),hash=process.env.ADMIN_PASSWORD_HASH||dummy;
  const matches=await compare(password,hash);
  return Boolean(expected&&process.env.ADMIN_PASSWORD_HASH&&matches&&email.trim().toLowerCase()===expected);
}
export async function checkLoginRateLimit(ipHash:string){
  const db=await ensureDatabase(),since=new Date(Date.now()-15*60_000).toISOString();
  const row=await db.prepare("SELECT COUNT(*)::int AS count FROM admin_login_attempts WHERE ip_hash=? AND successful=0 AND attempted_at>?").bind(ipHash,since).first<{count:number}>();
  return (row?.count||0)<10;
}
export async function recordLoginAttempt(ipHash:string,successful:boolean){
  const db=await ensureDatabase(),cutoff=new Date(Date.now()-86_400_000).toISOString();
  await db.batch([db.prepare("INSERT INTO admin_login_attempts (id,ip_hash,attempted_at,successful) VALUES (?,?,?,?)").bind(randomUUID(),ipHash,new Date().toISOString(),successful?1:0),db.prepare("DELETE FROM admin_login_attempts WHERE attempted_at<?").bind(cutoff)]);
}
export async function createAdminSession(email:string){
  const token=randomBytes(32).toString("base64url"),now=new Date(),expires=new Date(now.getTime()+MAX_AGE*1000);
  const db=await ensureDatabase();
  await db.prepare("INSERT INTO admin_sessions (id,email,token_hash,created_at,expires_at) VALUES (?,?,?,?,?)").bind(randomUUID(),email.toLowerCase(),tokenHash(token),now.toISOString(),expires.toISOString()).run();
  (await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:MAX_AGE});
}
export async function destroyAdminSession(){
  const jar=await cookies(),token=jar.get(COOKIE)?.value;
  if(token){const db=await ensureDatabase();await db.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(tokenHash(token)).run();}
  jar.set(COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});
}
