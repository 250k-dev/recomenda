import { Check, Close } from "./icons";
import { Container, Section, SectionHeading, cn } from "./primitives";
import { Reveal } from "./reveal";

const before = [
  "Recalcular datas na mão toda vez que uma aplicação atrasa",
  "Copiar e colar as mesmas recomendações a cada safra",
  "Estoque, compras e preços espalhados em arquivos soltos",
  "Sem histórico do que foi recomendado versus o que foi comprado",
];

const after = [
  "Datas das próximas etapas recalculadas a cada registro",
  "Modelos de época e mix reutilizados em todos os talhões",
  "Estoque debitado automaticamente na hora da aplicação",
  "Histórico completo da safra — do plano ao resultado",
];

export function Problem() {
  return (
    <Section id="problema" className="bg-cream">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Chega de planilha"
            title={
              <>
                A planilha não acompanha
                <br className="hidden sm:block" /> o ritmo da lavoura.
              </>
            }
            description="No campo, a data muda, o produto é substituído e o estoque acaba. A Recomenda foi feita para esse movimento — não para células congeladas."
          />
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <Reveal>
            <Panel
              variant="before"
              label="Na planilha"
              items={before}
            />
          </Reveal>
          <Reveal delay={120}>
            <Panel variant="after" label="Na Recomenda" items={after} />
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

function Panel({
  variant,
  label,
  items,
}: {
  variant: "before" | "after";
  label: string;
  items: string[];
}) {
  const isAfter = variant === "after";
  return (
    <div
      className={cn(
        "relative h-full overflow-hidden rounded-3xl p-7 ring-1 sm:p-9",
        isAfter
          ? "bg-brand-800 text-white ring-brand-900/20 shadow-lift"
          : "bg-sand/60 text-ink ring-line",
      )}
    >
      {isAfter ? (
        <div
          aria-hidden
          className="absolute -right-16 -top-16 size-56 rounded-full bg-brand-500/25 blur-2xl"
        />
      ) : null}
      <span
        className={cn(
          "relative inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
          isAfter ? "bg-white/12 text-brand-100" : "bg-ink/[0.06] text-ink/50",
        )}
      >
        {label}
      </span>
      <ul className="relative mt-6 space-y-3.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
                isAfter
                  ? "bg-brand-400/25 text-brand-100"
                  : "bg-ink/[0.05] text-ink/35",
              )}
            >
              {isAfter ? (
                <Check width={14} height={14} />
              ) : (
                <Close width={13} height={13} />
              )}
            </span>
            <span
              className={cn(
                "text-[0.95rem] leading-snug",
                isAfter ? "text-brand-50/90" : "text-ink/55",
              )}
            >
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
