import { getChatGPTUser } from "../../chatgpt-auth";

export async function authorizeAdmin(){
  const user=await getChatGPTUser();
  if(!user)return false;
  const allowed=(process.env.ADMIN_EMAILS||"").split(",").map(value=>value.trim().toLowerCase()).filter(Boolean);
  return allowed.length===0||allowed.includes(user.email.toLowerCase());
}
