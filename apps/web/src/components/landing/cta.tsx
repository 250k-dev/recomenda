import { Logo } from "@/assets/logo";
import { links } from "./content";
import { Button, Container, Eyebrow, Section } from "./primitives";
import { Reveal } from "./reveal";

const subscribeHref = `mailto:${links.contactEmail}?subject=${encodeURIComponent(
  "Quero assinar a Recomenda",
)}`;

export function Cta() {
  return (
    <Section id="assinar" className="bg-cream">
      <Container>
        <Reveal>
          <div className="grain relative overflow-hidden rounded-[2.5rem] bg-brand-800 px-6 py-16 text-center shadow-lift sm:px-16 sm:py-20">
            {/* Decorative glows + watermark */}
            <div
              aria-hidden
              className="absolute -left-16 -top-16 size-72 rounded-full bg-brand-500/25 blur-[90px]"
            />
            <div
              aria-hidden
              className="absolute -bottom-24 -right-10 size-80 rounded-full bg-clay-500/20 blur-[90px]"
            />
            <Logo
              aria-hidden
              width={230}
              height={293}
              fill="#ffffff"
              className="pointer-events-none absolute -right-8 top-1/2 hidden -translate-y-1/2 opacity-[0.05] sm:block"
            />

            <div className="relative mx-auto max-w-2xl">
              <Eyebrow tone="light">Comece agora</Eyebrow>
              <h2 className="mt-5 font-display text-3xl font-semibold leading-[1.08] tracking-tight text-white text-balance sm:text-[2.75rem]">
                Pronto para recomendar com método?
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-brand-100/85 text-pretty">
                Configure seus modelos, convide seus produtores e acompanhe cada
                safra do plano à colheita. O time 250k ajuda você a começar.
              </p>

              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Button href={subscribeHref} variant="clay" size="lg" withArrow>
                  Assinar a Recomenda
                </Button>
                <Button href={links.appUrl} variant="light" size="lg">
                  Acessar a plataforma
                </Button>
              </div>

              <p className="mt-7 text-sm text-brand-100/70">
                Planos por cota de talhões ativos · Apoio na configuração inicial
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
