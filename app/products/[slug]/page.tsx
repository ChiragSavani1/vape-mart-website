import { notFound } from "next/navigation";
import { getProductVolume } from "../../data";
import { Footer, Header, ProductArt, ProductCard } from "../../storefront";
import { loadProducts } from "../../../db/catalog";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const products=await loadProducts();
  const product = products.find(item => item.slug === slug);
  if (!product) notFound();
  const volume = getProductVolume(product);
  return <><Header/><main className="subpage"><div className="subpage-wrap detail">
    <div className="detail-art"><ProductArt product={product}/></div>
    <div className="detail-copy"><p className="eyebrow">{product.brand} · {product.category}</p><h1>{product.name}</h1>
      <div className="price">{product.promoPrice ? <><del>${product.price.toFixed(2)}</del> ${product.promoPrice.toFixed(2)}</> : `$${product.price.toFixed(2)}`}</div>
      <p className="muted">Browse product details and ask our Ontario store to confirm current availability. Availability may change and this request does not reserve or purchase the product.</p>
      <div className="detail-facts"><div><small>Flavour</small><b>{product.flavour}</b></div><div><small>{volume ? "Bottle size" : "Category"}</small><b>{volume || product.category}</b></div><div><small>UPC</small><b>{product.upc}</b></div></div>
      <ProductCard product={product}/>
    </div>
  </div></main><Footer/></>;
}
