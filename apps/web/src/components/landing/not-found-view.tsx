import { links } from "./content";
import { LandingShell } from "./landing-shell";
import { Button, Container, Eyebrow } from "./primitives";

export function NotFoundView() {
  return (
    <LandingShell>
      <section className="grain relative overflow-hidden bg-hero-mesh">
        <Container className="relative flex min-h-[70vh] flex-col items-center justify-center py-28 text-center sm:py-36">
          <Eyebrow tone="clay">Erro 404</Eyebrow>
          <p
            aria-hidden
            className="mt-6 font-display text-[6.5rem] font-semibold leading-none tracking-tight text-brand-700/15 sm:text-[9rem]"
          >
            404
          </p>
          <h1 className="mt-2 max-w-xl font-display text-4xl font-semibold tracking-tight text-ink text-balance sm:text-5xl">
            Esta página não existe
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted text-pretty sm:text-lg">
            O endereço pode estar errado ou a página foi removida. Volte ao
            início da Recomenda ou entre na plataforma.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button href="/" variant="primary" size="lg" withArrow>
              Ir para o início
            </Button>
            <Button href={links.appUrl} variant="outline" size="lg">
              Entrar
            </Button>
          </div>
        </Container>
      </section>
    </LandingShell>
  );
}
