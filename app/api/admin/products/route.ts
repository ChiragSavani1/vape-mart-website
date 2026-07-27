import { NextRequest, NextResponse } from "next/server";
import { ensureProductSeed, loadProducts } from "../../../../db/catalog";
import { authorizeAdmin } from "../authorize";

const slugify=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g,"").trim().replace(/[\s_]+/g,"-").slice(0,90);

export async function GET(){
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  return NextResponse.json({products:await loadProducts(true)});
}

export async function POST(request:NextRequest){
  if(!await authorizeAdmin())return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const name=String(body.name||"").trim(),upc=String(body.upc||"").replace(/\D/g,"");
    const brand=String(body.brand||"").trim(),category=String(body.category||"").trim();
    const price=Number(body.price),image=String(body.image||"").trim();
    if(!name||!upc||!brand||!category||category.toLowerCase().includes("hardware")||!Number.isFinite(price)||price<0)
      return NextResponse.json({error:"Enter a valid non-Hardware product, UPC, brand, category, and price."},{status:400});
    const id=crypto.randomUUID(),slug=`${slugify(name)}-${upc.slice(-4)}`,now=new Date().toISOString();
    const db=await ensureProductSeed();
    await db.prepare("INSERT INTO products (id,upc,slug,name,brand,category,flavour,price,image_key,visible,featured,manual_name,manual_brand,manual_category,manual_image,updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,0,1,1,1,1,?)")
      .bind(id,upc,slug,name,brand,category,String(body.flavour||""),price,image||null,now).run();
    return NextResponse.json({ok:true,product:{id,upc,slug,name,brand,category,flavour:String(body.flavour||""),price,image:image||undefined,accent:"#333333",visible:true,featured:false,missingReview:false}},{status:201});
  }catch(error){
    console.error("admin_product_create_failed",error);
    return NextResponse.json({error:"Could not add the product. Check that the UPC is unique."},{status:500});
  }
}
