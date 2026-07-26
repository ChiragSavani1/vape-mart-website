import { Storefront } from "./storefront";
import { loadProducts } from "../db/catalog";
import { loadBanners } from "../db/assets";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [catalogue,customBanners]=await Promise.all([loadProducts(),loadBanners()]);
  return <Storefront catalogue={catalogue} banners={customBanners}/>;
}
