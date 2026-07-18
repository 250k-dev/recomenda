import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/auth/session";
import { routes } from "@/config/routes";

export default async function Home() {
  const role = await getSessionRole();
  if (role === "ADMIN") redirect(routes.admin.dashboard);
  if (role === "AGRONOMIST" || role === "STAFF") redirect(routes.dashboard);
  if (role === "PRODUCER") redirect(routes.acessoProdutor);
  redirect(routes.login());
}
