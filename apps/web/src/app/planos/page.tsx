import type { Metadata } from "next";
import { siteUrl } from "@/components/landing/content";
import { PlansView } from "@/components/landing/plans-view";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Planos — Recomenda",
  description:
    "Planos da Recomenda por cota de talhões. Ciclo de 12 meses (duas safras), compartilhamento ilimitado, Lico no WhatsApp e Casa 250k. PIX com 10% de desconto.",
};

export default function PlanosPage() {
  return <PlansView />;
}
