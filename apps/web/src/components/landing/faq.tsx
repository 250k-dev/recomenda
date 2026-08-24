import { faqs, links } from "./content";
import { Container, Section, SectionHeading } from "./primitives";
import { Reveal } from "./reveal";

export function Faq() {
  return (
    <Section id="perguntas" className="bg-cream">
      <Container className="max-w-3xl">
        <Reveal>
          <SectionHeading
            eyebrow="Perguntas frequentes"
            title="O que costumam perguntar"
            description="Ainda com dúvida? Fale com a gente — respondemos rápido."
          />
        </Reveal>

        <div className="mt-12 space-y-3">
          {faqs.map((faq, i) => (
            <Reveal key={faq.question} delay={Math.min(i, 3) * 70}>
              <details className="group rounded-2xl border border-line bg-surface px-6 transition-shadow open:shadow-soft">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl py-5 outline-none [&::-webkit-details-marker]:hidden focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2">
                  <span className="text-[1.02rem] font-semibold text-ink">
                    {faq.question}
                  </span>
                  <span
                    aria-hidden
                    className="faq-icon relative grid size-6 shrink-0 place-items-center text-brand-600"
                  >
                    <span className="absolute h-0.5 w-3.5 rounded-full bg-current" />
                    <span className="absolute h-3.5 w-0.5 rounded-full bg-current" />
                  </span>
                </summary>
                <p className="-mt-1 pb-6 pr-8 text-[0.95rem] leading-relaxed text-muted">
                  {faq.answer}
                </p>
              </details>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <p className="mt-8 text-center text-sm text-muted">
            Não achou sua resposta?{" "}
            <a
              href={`mailto:${links.contactEmail}`}
              className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 transition-colors hover:text-brand-800"
            >
              Escreva para {links.contactEmail}
            </a>
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
