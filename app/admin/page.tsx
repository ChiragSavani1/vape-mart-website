import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { AdminDashboard } from "./dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  const allowed = (process.env.ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(user.email.toLowerCase())) {
    return <main className="admin-denied"><div><h1>Access restricted</h1><p>{user.email} is signed in but is not on the Vape Mart admin allowlist.</p><a href={chatGPTSignOutPath("/")}>Sign out</a></div></main>;
  }
  return <AdminDashboard user={user.displayName} signOut={chatGPTSignOutPath("/")} />;
}
