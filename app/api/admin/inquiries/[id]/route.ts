import { NextRequest, NextResponse } from "next/server";
import { ensureDatabase } from "../../../../../db/runtime";
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
  if(status!=="Pending"&&inquiry.contact.includes("@")&&process.env.RESEND_API_KEY){
    await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:`Bearer ${process.env.RESEND_API_KEY}`,"content-type":"application/json"},body:JSON.stringify({
      from:process.env.EMAIL_FROM||"Vape Mart <inquiries@example.com>",to:[inquiry.contact],
      subject:`Vape Mart availability: ${inquiry.product_name}`,
      text:`Hello ${inquiry.customer_name},\n\n${inquiry.product_name} is ${status==="Available"?"currently available":"currently unavailable"} at Vape Mart.\n\nAvailability can change and this message is not a reservation or order. Adults 19+ only.\n\nVape Mart`
    })});
  }
  return NextResponse.json({ok:true,status});
}
