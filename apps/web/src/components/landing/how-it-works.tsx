import { links, steps } from "./content";
import { Icon } from "./icons";
import { Button, Container, Section, SectionHeading } from "./primitives";
import { Reveal } from "./reveal";

export function HowItWorks() {
  return (
    <Section id="como-funciona" className="bg-surface">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Como funciona"
            title="Da configuração à colheita em quatro passos"
            description="Você configura uma vez e a Recomenda acompanha cada safra — do primeiro modelo ao fechamento do resultado."
          />
        </Reveal>

        <div className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {steps.map((step, i) => (
            <Reveal key={step.number} delay={i * 110}>
              <div className="relative flex flex-col">
                {i < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute left-16 -right-6 top-7 hidden border-t-2 border-dashed border-brand-200 lg:block"
                  />
                ) : null}

                <div className="flex items-center gap-4">
                  <span className="relative z-10 grid size-14 place-items-center rounded-2xl bg-brand-700 text-white shadow-soft ring-4 ring-surface">
                    <Icon name={step.icon} width={26} height={26} />
                  </span>
                  <span className="font-display text-4xl font-semibold text-brand-100">
                    {step.number}
                  </span>
                </div>

                <h3 className="mt-6 text-lg font-semibold tracking-tight text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="mt-16 flex justify-center">
            <Button href={links.subscribe} variant="primary" size="lg" withArrow>
              Começar com a Recomenda
            </Button>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
