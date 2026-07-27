import { NextRequest, NextResponse } from "next/server";
import { ensureDatabase } from "../../../../../db/runtime";
import { sendEmail } from "../../../../../db/email";
import { getChatGPTUser } from "../../../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getChatGPTUser(); if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const allowed=(process.env.ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(allowed.length&&!allowed.includes(user.email.toLowerCase()))return NextResponse.json({error:"Forbidden"},{status:403});
  const {id}=await params; const {status}=await request.json() as {status:string};
  if(!["Pending","Available","Unavailable"].includes(status))return NextResponse.json({error:"Invalid status"},{status:400});
  const db=await ensureDatabase();
  const inquiry=await db.prepare("SELECT customer_name, contact, product_name FROM inquiries WHERE id = ?").bind(id).first<{customer_name:string;contact:string;product_name:string}>();
  if(!inquiry)return NextResponse.json({error:"Not found"},{status:404});
  await db.prepare("UPDATE inquiries SET status = ?, responded_at = ? WHERE id = ?").bind(status,status==="Pending"?null:new Date().toISOString(),id).run();
  const delivery = status==="Pending"
    ? {status:"not_requested"}
    : inquiry.contact.includes("@")
      ? await sendEmail({
        to:inquiry.contact,
        subject:`Vape Mart availability: ${inquiry.product_name}`,
        text:`Hello ${inquiry.customer_name},\n\n${inquiry.product_name} is ${status==="Available"?"currently available":"currently unavailable"} at Vape Mart.\n\nAvailability can change and this message is not a reservation or order. Adults 19+ only.\n\nVape Mart\n307 Cundles Road East, Barrie, ON\n(705) 721-8181`,
      })
      : {status:"manual_phone_follow_up"};
  return NextResponse.json({ok:true,status,delivery});
}
