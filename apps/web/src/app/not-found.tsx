import type { Metadata } from "next";
import { NotFoundView } from "@/components/landing/not-found-view";

export const metadata: Metadata = {
  title: "Página não encontrada — Recomenda",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundView />;
}
