import { NextResponse } from "next/server";
import { destroyAdminSession } from "../../../../db/auth";
export async function POST(request:Request){await destroyAdminSession();return NextResponse.redirect(new URL("/",request.url),303);}
