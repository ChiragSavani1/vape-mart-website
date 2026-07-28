"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
export function LoginForm(){
  const router=useRouter(),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");const data=new FormData(event.currentTarget);const response=await fetch("/api/admin/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:data.get("email"),password:data.get("password")})});const result=await response.json().catch(()=>null);if(!response.ok){setError(result?.error||"Sign in failed.");setBusy(false);return}router.replace("/admin");router.refresh();}
  return <form className="admin-login-form" onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="username" required/></label><label>Password<input name="password" type="password" autoComplete="current-password" required/></label>{error&&<p role="alert">{error}</p>}<button disabled={busy}>{busy?"Signing in…":"Sign in"}</button></form>;
}
