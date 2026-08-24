import type { Metadata } from "next";
import { siteUrl } from "@/components/landing/content";
import { TermsView } from "@/components/landing/terms-view";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Termos de uso — Recomenda",
  description:
    "Termos de uso da Recomenda na plataforma web e no WhatsApp (Lico). Uma solução 250k.",
};

export default function TermsPage() {
  return <TermsView />;
}
