import { AppMock } from "./app-mock";
import { links } from "./content";
import { Monitor, Phone, Sprout } from "./icons";
import { Button, Container, Eyebrow } from "./primitives";
import { Reveal } from "./reveal";

function Contours() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute right-0 top-0 h-[42rem] w-[42rem] max-w-none translate-x-1/4 -translate-y-1/4 text-brand-700/[0.07]"
      viewBox="0 0 600 600"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <path
          key={i}
          d={`M ${40 + i * 12} 560 C ${160 + i * 10} ${360 - i * 18}, ${360 - i * 8} ${420 - i * 12}, ${560} ${180 - i * 14}`}
        />
      ))}
    </svg>
  );
}

export function Hero() {
  return (
    <section id="top" className="grain relative overflow-hidden bg-hero-mesh">
      <Contours />
      <Container className="relative grid items-center gap-14 pb-24 pt-28 sm:pt-36 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-32">
        <div className="max-w-xl">
          <Reveal>
            <Eyebrow tone="clay">Uma solução 250k</Eyebrow>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-ink text-balance sm:text-6xl">
              A recomendação agrícola{" "}
              <span className="relative whitespace-nowrap text-brand-700">
                no tempo certo
                <svg
                  aria-hidden
                  viewBox="0 0 300 14"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1.5 left-0 h-2.5 w-full text-clay-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={5}
                  strokeLinecap="round"
                >
                  <path d="M4 9C60 3 150 3 296 8" />
                </svg>
              </span>
              , do plantio à colheita.
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-6 text-lg leading-relaxed text-muted text-pretty">
              A Recomenda reúne recomendação, lista de compras, estoque e
              resultado em uma só plataforma — para o{" "}
              <strong className="font-semibold text-ink">agrônomo e a equipe</strong>{" "}
              planejarem e para o{" "}
              <strong className="font-semibold text-ink">produtor</strong>{" "}
              executar no campo, com o Lico no WhatsApp.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button href={links.subscribe} variant="primary" size="lg" withArrow>
                Assinar a Recomenda
              </Button>
              <Button href="#como-funciona" variant="outline" size="lg">
                Ver como funciona
              </Button>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <ul className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-muted">
              <li className="inline-flex items-center gap-2">
                <Sprout width={18} height={18} className="text-brand-600" />
                Soja &amp; milho
              </li>
              <li className="inline-flex items-center gap-2">
                <Monitor width={18} height={18} className="text-brand-600" />
                Plataforma web
              </li>
              <li className="inline-flex items-center gap-2">
                <Phone width={18} height={18} className="text-brand-600" />
                Lico no WhatsApp
              </li>
            </ul>
          </Reveal>
        </div>

        <Reveal delay={160} className="relative">
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-brand-200/40 via-transparent to-clay-200/40 blur-2xl"
          />
          <AppMock />
        </Reveal>
      </Container>
    </section>
  );
}
