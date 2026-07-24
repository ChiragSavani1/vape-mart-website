import { Storefront } from "./storefront";
import { loadProducts } from "../db/catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const catalogue=await loadProducts();
  return <Storefront catalogue={catalogue}/>;
}
