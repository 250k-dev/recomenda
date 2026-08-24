import { links } from "./content";
import { LandingShell } from "./landing-shell";
import { Container } from "./primitives";

export type LegalSection = {
  id: string;
  title: string;
  body: readonly string[];
};

export type LegalTocItem = {
  id: string;
  label: string;
};

export function LegalDocView({
  eyebrow,
  title,
  updatedAt,
  intro,
  toc,
  sections,
}: {
  eyebrow: string;
  title: string;
  updatedAt: string;
  intro: string;
  toc: readonly LegalTocItem[];
  sections: readonly LegalSection[];
}) {
  return (
    <LandingShell>
      <Container className="grid gap-12 pt-28 pb-12 sm:pt-36 lg:grid-cols-[14rem_minmax(0,42rem)] lg:gap-16 lg:py-16 lg:pt-36">
        <nav aria-label="Seções deste documento" className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Nesta página
            </p>
            <ul className="mt-4 space-y-1.5">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="block rounded-lg px-2 py-1.5 text-sm text-ink/70 transition-colors hover:bg-ink/[0.04] hover:text-brand-700"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <article className="max-w-prose">
          <p className="text-sm font-medium text-brand-700">{eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink text-balance sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-sm text-muted">
            Última atualização: {updatedAt}
          </p>
          <p className="mt-6 text-base leading-relaxed text-muted">{intro}</p>

          <div className="mt-12 space-y-12">
            {sections.map((section) => (
              <section key={section.id} id={section.id}>
                <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-3">
                  {section.body.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-[1.05rem] leading-relaxed text-muted"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-14 border-t border-line pt-8 text-sm text-muted">
            Dúvidas?{" "}
            <a
              href={`mailto:${links.contactEmail}`}
              className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-800"
            >
              {links.contactEmail}
            </a>
          </p>
        </article>
      </Container>
    </LandingShell>
  );
}
