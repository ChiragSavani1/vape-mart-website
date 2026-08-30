import { notFound } from "next/navigation";
import { Footer, Header } from "../../storefront";
import { loadProducts } from "../../../db/catalog";
import { ProductDetailClient } from "./product-detail-client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params,product=(await loadProducts()).find(item=>item.slug===slug);
  if(!product)return {title:"Product not found | Vape Mart"};
  return {title:`${product.name} | Vape Mart Barrie`,description:`Browse ${product.name} by ${product.brand} and ask Vape Mart in Barrie to confirm in-store availability.`,openGraph:{title:`${product.name} | Vape Mart`,description:`View product details and check availability at Vape Mart in Barrie.`,images:product.image?[{url:product.image,alt:product.name}]:[]}};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const products=await loadProducts();
  const product = products.find(item => item.slug === slug);
  if (!product) notFound();
  const related=products.filter(item=>item.id!==product.id&&item.category===product.category).slice(0,5);
  return <div className="product-detail-theme"><Header categories={[...new Set(products.map(item=>item.category))]}/><ProductDetailClient product={product} related={related}/><Footer/></div>;
}
