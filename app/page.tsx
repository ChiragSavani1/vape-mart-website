import { Storefront } from "./storefront";
import { loadProducts } from "../db/catalog";
import { loadBanners } from "../db/assets";
import { loadStoreHours } from "../db/store-settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [catalogue,customBanners,storeHours]=await Promise.all([loadProducts(),loadBanners(),loadStoreHours()]);
  return <Storefront catalogue={catalogue} banners={customBanners} storeHours={storeHours}/>;
}
