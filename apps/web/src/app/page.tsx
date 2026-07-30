import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/auth/session";
import { routes } from "@recomenda/config";

export default async function Home() {
  const role = await getSessionRole();
  if (role === "ADMIN" || role === "ORG_ADMIN") redirect(routes.admin.dashboard);
  if (role === "AGRONOMIST" || role === "STAFF" || role === "PRODUCER") {
    redirect(routes.dashboard);
  }
  redirect(routes.login());
}
