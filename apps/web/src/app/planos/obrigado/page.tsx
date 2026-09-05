import type { Metadata } from "next";
import { siteUrl, links } from "@/components/landing/content";
import { LandingShell } from "@/components/landing/landing-shell";
import { Button, Container, Eyebrow } from "@/components/landing/primitives";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Pagamento recebido — Recomenda",
  description: "Seu pagamento foi enviado. Confira o e-mail para criar a senha e entrar na Recomenda.",
};

export default function PlanosObrigadoPage() {
  return (
    <LandingShell>
      <section className="grain relative overflow-hidden bg-hero-mesh">
        <Container className="relative max-w-2xl pb-24 pt-28 sm:pt-36">
          <Eyebrow tone="clay">Uma solução 250k</Eyebrow>
          <h1 className="mt-5 font-display text-[2.4rem] font-semibold leading-[1.08] tracking-tight text-ink text-balance sm:text-5xl">
            Quase lá
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted text-pretty">
            Se o pagamento foi confirmado, em instantes você recebe um e-mail
            para criar a senha e entrar na plataforma. Olhe também a caixa de
            spam.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button href={links.appUrl} variant="primary" size="lg" withArrow>
              Ir para o login
            </Button>
            <Button href={links.subscribe} variant="outline" size="lg">
              Voltar aos planos
            </Button>
          </div>
        </Container>
      </section>
    </LandingShell>
  );
}
