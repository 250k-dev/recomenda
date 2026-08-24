import type { Metadata } from "next";
import { siteUrl } from "@/components/landing/content";
import { PrivacyView } from "@/components/landing/privacy-view";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Política de privacidade — Recomenda",
  description:
    "Como a Recomenda trata dados pessoais na plataforma web e no WhatsApp (Lico). Uma solução 250k.",
};

export default function PrivacyPage() {
  return <PrivacyView />;
}
