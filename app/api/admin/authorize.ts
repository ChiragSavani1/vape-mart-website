import { headers } from "next/headers";
import { getAdminSession } from "../../../db/auth";
export async function authorizeAdmin(){
  if(!await getAdminSession())return false;
  const h=await headers(),origin=h.get("origin"),host=h.get("x-forwarded-host")||h.get("host");
  if(origin&&host&&new URL(origin).host!==host)return false;
  return true;
}
