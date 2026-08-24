import type { Metadata } from "next";
import { siteUrl } from "@/components/landing/content";
import { LandingView } from "@/components/landing/landing-view";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    absolute:
      "Recomenda — Recomendações agrícolas no tempo certo, do plantio à colheita",
  },
  description:
    "Recomenda reúne recomendações, lista de compras, estoque e resultados em uma só plataforma. Feito para agrônomos, equipes e produtores que trabalham com soja e milho. Uma solução 250k.",
  applicationName: "Recomenda",
  keywords: [
    "recomendação agronômica",
    "agronomia",
    "agrônomo",
    "produtor rural",
    "soja",
    "milho",
    "safra",
    "talhão",
    "lista de compras agrícola",
    "controle de estoque agrícola",
    "agtech",
    "250k",
  ],
  authors: [{ name: "250k" }],
  creator: "250k",
  publisher: "250k",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName: "Recomenda",
    title: "Recomenda — a recomendação agrícola no tempo certo",
    description:
      "Da recomendação à colheita em uma só plataforma. Modelos reutilizáveis, datas que se recalculam sozinhas, estoque automático e relatórios de resultado. Para agrônomos, equipes e produtores.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Recomenda — a recomendação agrícola no tempo certo",
    description:
      "Da recomendação à colheita em uma só plataforma. Para agrônomos, equipes e produtores. Uma solução 250k.",
  },
  category: "agriculture",
};

export default function Home() {
  return <LandingView />;
}
