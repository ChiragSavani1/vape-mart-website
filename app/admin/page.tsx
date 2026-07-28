import { redirect } from "next/navigation";
import { getAdminSession } from "../../db/auth";
import { AdminDashboard } from "./dashboard";
import { ensureDatabase } from "../../db/runtime";
import { loadProducts, type AdminProduct } from "../../db/catalog";
import { loadBanners, type SiteBanner } from "../../db/assets";
import { emailIsConfigured } from "../../db/email";
import { loadStoreHours } from "../../db/store-settings";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getAdminSession();
  if(!user)redirect("/admin/login");
  let databaseError = "";
  let adminProducts:AdminProduct[] = [];
  let initialBanners:SiteBanner[] = [];
  const initialStoreHours=await loadStoreHours();
  let initialRequests: Array<{id:string;customer:string;contact:string;product:string;time:string;status:"Pending"|"Available"|"Unavailable"}> = [];
  try {
    const db = await ensureDatabase();
    const rows = await db.prepare(
      "SELECT id, customer_name, contact, product_name, status, created_at FROM inquiries ORDER BY created_at DESC LIMIT 100"
    ).all<{id:string;customer_name:string;contact:string;product_name:string;status:"Pending"|"Available"|"Unavailable";created_at:string}>();
    initialRequests = (rows.results || []).map(row => ({
      id: row.id,
      customer: row.customer_name,
      contact: row.contact,
      product: row.product_name,
      time: `${new Date(row.created_at).toISOString().replace("T", " ").slice(0, 16)} UTC`,
      status: row.status,
    }));
  } catch (error) {
    console.error("admin_inquiries_load_failed", error);
    databaseError = "Availability requests could not be loaded. Refresh the page to try again.";
  }
  try {
    [adminProducts,initialBanners] = await Promise.all([loadProducts(true),loadBanners()]);
  } catch (error) {
    console.error("admin_products_load_failed", error);
    databaseError = databaseError || "Products could not be loaded. Refresh the page to try again.";
  }
  return <AdminDashboard
    user={user.email}
    signOut="/api/admin/logout"
    initialRequests={initialRequests}
    emailConfigured={emailIsConfigured()}
    databaseError={databaseError}
    initialProducts={adminProducts}
    initialBanners={initialBanners}
    initialStoreHours={initialStoreHours}
  />;
}
