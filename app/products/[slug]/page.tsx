import { notFound } from "next/navigation";
import { Footer, Header } from "../../storefront";
import { loadProducts } from "../../../db/catalog";
import { ProductDetailClient } from "./product-detail-client";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const products=await loadProducts();
  const product = products.find(item => item.slug === slug);
  if (!product) notFound();
  return <div className="product-detail-theme"><Header/><ProductDetailClient product={product}/><Footer/></div>;
}
