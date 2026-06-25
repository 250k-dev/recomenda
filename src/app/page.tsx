import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/auth/session";

export default async function Home() {
  const role = await getSessionRole();
  if (role === "ADMIN") redirect("/admin");
  if (role === "AGRONOMIST") redirect("/dashboard");
  if (role === "PRODUCER") redirect("/producer-only");
  redirect("/login");
}
