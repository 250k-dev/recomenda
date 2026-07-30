import { redirect } from "next/navigation";
import { routes } from "@recomenda/config";

/** Legado: produtores entram no painel web. Mantém a URL antiga redirecionando. */
export default function AcessoProdutorRedirectPage() {
  redirect(routes.dashboard);
}
