import { NextRequest, NextResponse } from "next/server";
import { saveStoreHours, type StoreHours } from "../../../../db/store-settings";
import { authorizeAdmin } from "../authorize";

function clean(value:unknown) {
  return String(value||"").trim().slice(0,80);
}

export async function PUT(request:NextRequest) {
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
    const body=await request.json() as Partial<StoreHours>;
    const hours:StoreHours={
      weekdays:clean(body.weekdays),
      saturday:clean(body.saturday),
      sunday:clean(body.sunday),
    };
    if(Object.values(hours).some(value=>value.length<3)){
      return NextResponse.json({error:"Enter opening hours for weekdays, Saturday, and Sunday."},{status:400});
    }
    await saveStoreHours(hours);
    return NextResponse.json({ok:true,hours});
  } catch (error) {
    console.error("store_hours_save_failed",error);
    return NextResponse.json({error:"Store hours could not be saved."},{status:500});
  }
}
