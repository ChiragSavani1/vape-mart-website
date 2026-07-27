import { redirect } from "next/navigation";
import { getAdminSession } from "../../../db/auth";
import { LoginForm } from "./login-form";
export const dynamic="force-dynamic";
export default async function LoginPage(){if(await getAdminSession())redirect("/admin");return <main className="admin-login"><section><img src="/brand/vape-mart-logo-small.webp" alt="Vape Mart"/><p>VAPE MART ADMIN</p><h1>Secure sign in</h1><LoginForm/></section></main>;}
