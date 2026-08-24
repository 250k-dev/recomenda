import { features } from "./content";
import { Icon } from "./icons";
import { Container, Section, SectionHeading, cn } from "./primitives";
import { Reveal } from "./reveal";

export function Features() {
  return (
    <Section id="recursos" className="bg-surface">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Recursos"
            title="Tudo o que a safra precisa, num lugar só"
            description="Da configuração dos modelos ao relatório de colheita, a Recomenda cobre o ciclo inteiro da recomendação agronômica."
          />
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const clay = feature.icon === "tag" || feature.icon === "chart";
            return (
              <Reveal key={feature.title} delay={(i % 3) * 90}>
                <article className="group h-full rounded-2xl border border-line bg-cream/50 p-6 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-brand-700/15 hover:shadow-soft">
                  <span
                    className={cn(
                      "grid size-12 place-items-center rounded-xl ring-1 transition-colors",
                      clay
                        ? "bg-clay-50 text-clay-600 ring-clay-600/12 group-hover:bg-clay-100"
                        : "bg-brand-50 text-brand-700 ring-brand-700/12 group-hover:bg-brand-100",
                    )}
                  >
                    <Icon name={feature.icon} width={23} height={23} />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
                    {feature.description}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
