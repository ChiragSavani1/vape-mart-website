import { NextRequest, NextResponse } from "next/server";
import { ensureDatabase, sha256 } from "../../../db/runtime";
import { sendEmail } from "../../../db/email";

export const dynamic = "force-dynamic";

function validContact(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.replace(/\D/g, "").length >= 10;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.website) return NextResponse.json({ ok: true });
    const name = String(body.name || "").trim().slice(0, 100);
    const contact = String(body.contact || "").trim().slice(0, 200);
    const productId = String(body.productId || "").trim().slice(0, 80);
    const productName = String(body.productName || "").trim().slice(0, 200);
    const quantity = Math.max(1, Math.min(99, Number.parseInt(String(body.quantity || "1"), 10) || 1));
    const message = String(body.message || "").trim().slice(0, 1000);
    if (name.length < 2 || !validContact(contact) || !productId || !productName) {
      return NextResponse.json({ error: "Please provide a valid name and email or phone number." }, { status: 400 });
    }
    const db = await ensureDatabase();
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
    const ipHash = await sha256(`${ip}:${process.env.RATE_LIMIT_SALT || "vapemart"}`);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await db.prepare("SELECT COUNT(*) AS count FROM inquiries WHERE ip_hash = ? AND created_at > ?").bind(ipHash, since).first<{count:number}>();
    if ((recent?.count || 0) >= 5) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await db.prepare("INSERT INTO inquiries (id, product_id, product_name, customer_name, contact, status, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?)")
      .bind(id, productId, productName, name, contact, ipHash, createdAt).run();
    const notification = await notifyStore({ id, name, contact, productName, quantity, message, createdAt });
    return NextResponse.json({ ok: true, id, notification: notification.status }, { status: 201 });
  } catch (error) {
    console.error("inquiry_create_failed", error);
    return NextResponse.json({ error: "Unable to send the request right now." }, { status: 500 });
  }
}

async function notifyStore(input: {id:string;name:string;contact:string;productName:string;quantity:number;message:string;createdAt:string}) {
  return sendEmail({
    to: process.env.AVAILABILITY_TO || "vapemart307@gmail.com",
    subject: `Availability request: ${input.productName}`,
    text: `New availability request\n\nProduct: ${input.productName}\nQuantity: ${input.quantity}\nCustomer: ${input.name}\nContact: ${input.contact}\nMessage: ${input.message || "None provided"}\nRequest: ${input.id}\nReceived: ${input.createdAt}`,
  });
}
