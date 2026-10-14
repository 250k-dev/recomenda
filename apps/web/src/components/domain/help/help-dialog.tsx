"use client";

import { useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  BookA,
  BookOpen,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleQuestionMark,
  Compass,
  Info,
  Keyboard,
  LocateFixed,
  Mail,
  MessageCircleQuestionMark,
  Play,
  Route as RouteIcon,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { AccessLevel } from "@recomenda/api/auth-types";
import { useMe, useMemberships } from "@recomenda/api-hooks";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { Input } from "@recomenda/ui/primitives/input";
import { cn } from "@recomenda/utils";
import { links } from "@/components/landing/content";
import { useHelpTourStore } from "@/stores/help-tour";
import {
  generalFaq,
  generalFormulas,
  generalGuide,
  glossary,
  interfaceTour,
  shortcuts,
} from "./generic-help";
import {
  highlightNode,
  highlightText,
  nodeText,
  searchItems,
  searchTerms,
} from "./help-search";
import { buildTourSteps, visibleTourTarget } from "./help-tour";
import { resolvePageHelp } from "./registry";
import type {
  HelpContext,
  HelpFaqItem,
  HelpFormula,
  HelpGlossaryTerm,
  HelpSection,
  HelpShell,
  HelpShortcut,
  HelpTourStep,
} from "./types";

type HelpView = "home" | "docs" | "formulas" | "glossary" | "faq" | "shortcuts";

const VIEW_TITLES: Record<Exclude<HelpView, "home">, string> = {
  docs: "Documentação",
  formulas: "Fórmulas e cálculos",
  glossary: "Glossário",
  faq: "Perguntas frequentes",
  shortcuts: "Atalhos de teclado",
};

/** Rodapé "Falar com a 250k" — oculto por enquanto; `true` traz de volta. */
const SHOW_CONTACT = false;

const NO_TERMS: string[] = [];

/** Papel, nível e carteiras do usuário — o que muda o que a ajuda mostra. */
function useHelpContext(shell: HelpShell): HelpContext {
  const { data: me } = useMe();
  const { data: memberships } = useMemberships();
  const role = me?.role ?? null;
  const accessLevel = (me?.access_level ?? null) as AccessLevel | null;
  const scopes =
    (memberships?.has_own_carteira ? 1 : 0) +
    (memberships?.memberships.length ?? 0);
  return {
    shell,
    role,
    accessLevel,
    // Mesma regra que esconde a busca em `ProducerSearchButton`.
    canSearchProducers:
      role !== "PRODUCER" &&
      !(
        role === "STAFF" &&
        (accessLevel === "FARM_MANAGER" || accessLevel === "FARM_OPERATOR")
      ),
    // Mesma regra que mostra o `ScopeSwitcher`.
    hasMultipleScopes: scopes > 1,
  };
}

/** Uma entrada clicável do modal: tour, seção ou elemento a mostrar na tela. */
type HelpOptionItem = {
  key: string;
  group?: "page" | "reference";
  icon: LucideIcon;
  title: string;
  description: string;
  /** `play` inicia algo (tour); `open` navega para uma seção do modal. */
  action?: "open" | "play";
  onClick: () => void;
  className?: string;
};

/**
 * Central de ajuda da tela atual: tours, documentação, cálculos e referência.
 * O conteúdo específico vem de `registry.tsx`; o que a tela não tiver cai no
 * genérico de `generic-help.tsx`.
 */
export function HelpDialog({
  open,
  onOpenChange,
  shell,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shell: HelpShell;
}) {
  const pathname = usePathname();
  const ctx = useHelpContext(shell);
  const page = resolvePageHelp(pathname);
  const startTour = useHelpTourStore((s) => s.start);
  const [view, setView] = useState<HelpView>("home");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // Tour escolhido no modal: só começa depois que ele termina de fechar, senão
  // o foco e o overlay do Dialog brigam com os do tour. Estado, não ref: as
  // opções guardam o `onClick` num objeto e o compilador não aceita ref ali.
  const [pendingTour, setPendingTour] = useState<HelpTourStep[] | null>(null);

  const pageTour = page?.tour ?? [];
  const pageDocs = page?.docs ?? [];
  const pageFormulas = page?.formulas ?? [];
  const pageFaq = page?.faq ?? [];
  const guide = generalGuide(ctx);
  const formulas = generalFormulas(ctx);
  const faq = generalFaq(ctx);
  const keyboard = shortcuts(ctx);
  const terms = searchTerms(query);
  const searching = view === "home" && terms.length > 0;

  const launchTour = (steps: HelpTourStep[]) => {
    setPendingTour(steps);
    onOpenChange(false);
  };

  const options: HelpOptionItem[] = [
    ...(pageTour.length > 0
      ? [
          {
            key: "page-tour",
            group: "page" as const,
            icon: RouteIcon,
            title: "Tour desta tela",
            description: "Os elementos desta tela, um de cada vez.",
            action: "play" as const,
            onClick: () => launchTour(pageTour),
          },
        ]
      : []),
    {
      key: "interface-tour",
      group: "page",
      icon: Compass,
      title: "Tour da interface",
      description:
        shell === "admin"
          ? "Menu, notificações e perfil — o que está em toda tela."
          : "Trilha, busca, notificações e menu — o que está em toda tela.",
      action: "play",
      onClick: () => launchTour(interfaceTour(ctx)),
    },
    {
      key: "docs",
      group: "page",
      icon: BookOpen,
      title: "Documentação",
      description:
        pageDocs.length > 0
          ? "Como esta tela funciona, parte por parte."
          : "Guia geral de uso do Recomenda.",
      onClick: () => setView("docs"),
    },
    ...(pageFormulas.length + formulas.length > 0
      ? [
          {
            key: "formulas",
            group: "page" as const,
            icon: Calculator,
            title: "Fórmulas e cálculos",
            description:
              pageFormulas.length > 0
                ? "Como os números desta tela são calculados."
                : "DAP, janela, receita, dólar e sacas — as contas do dia a dia.",
            onClick: () => setView("formulas"),
          },
        ]
      : []),
    {
      key: "glossary",
      group: "reference",
      icon: BookA,
      title: "Glossário",
      description: "Safra, talhão, etapa, DAP e outros termos.",
      onClick: () => setView("glossary"),
    },
    {
      key: "faq",
      group: "reference",
      icon: MessageCircleQuestionMark,
      title: "Perguntas frequentes",
      description: "Respostas rápidas para as dúvidas mais comuns.",
      onClick: () => setView("faq"),
    },
    {
      key: "shortcuts",
      group: "reference",
      icon: Keyboard,
      title: "Atalhos de teclado",
      description: "Para quem prefere não tirar a mão do teclado.",
      onClick: () => setView("shortcuts"),
      // Sem teclado físico no celular, a lista só ocupa espaço.
      className: "max-sm:hidden",
    },
  ];

  const results = searching
    ? {
        options: searchItems(options, terms, (o) => ({
          title: o.title,
          body: o.description,
        })),
        // Passos dos tours viram "mostrar na tela" — só os que estão visíveis
        // agora, senão o destaque não teria onde cair.
        spots: searchItems(
          [...pageTour, ...interfaceTour(ctx)].flatMap<HelpOptionItem>(
            (step) =>
              step.target != null && visibleTourTarget(step.target)
                ? [
                    {
                      key: step.target,
                      icon: LocateFixed,
                      title: step.title,
                      description: nodeText(step.content),
                      action: "play",
                      onClick: () => launchTour([step]),
                    },
                  ]
                : [],
          ),
          terms,
          (o) => ({ title: o.title, body: o.description }),
        ),
        docs: searchItems([...pageDocs, ...guide], terms, (section) => ({
          title: section.title,
          body: section.body,
        })),
        formulas: searchItems([...pageFormulas, ...formulas], terms, (f) => ({
          title: f.name,
          body: [f.expressions.join(" "), f.description, f.example],
        })),
        faq: searchItems([...pageFaq, ...faq], terms, (item) => ({
          title: item.question,
          body: item.answer,
        })),
        glossary: searchItems(glossary(), terms, (item) => ({
          title: item.term,
          body: item.definition,
        })),
        shortcuts: searchItems(keyboard, terms, (shortcut) => ({
          title: shortcut.description,
          body: shortcut.keys.join(" "),
        })),
      }
    : null;
  const resultCount = results
    ? Object.values(results).reduce((sum, list) => sum + list.length, 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Altura fixa: com a busca, o conteúdo muda a cada tecla e o modal
        // centralizado subiria e desceria junto, levando o campo com ele.
        className="h-[calc(100dvh-2rem)] max-w-xl sm:h-[min(44rem,calc(100dvh-2rem))]"
        onOpenAutoFocus={(event) => {
          // No celular, focar a busca abriria o teclado por cima das opções.
          if (!window.matchMedia("(pointer: coarse)").matches) return;
          event.preventDefault();
          if (event.currentTarget instanceof HTMLElement) {
            event.currentTarget.focus();
          }
        }}
        onEscapeKeyDown={(event) => {
          // Com busca preenchida, Esc limpa a busca antes de fechar o modal.
          if (view !== "home" || !query) return;
          event.preventDefault();
          setQuery("");
          searchRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          setView("home");
          setQuery("");
          if (!pendingTour) return;
          setPendingTour(null);
          // Devolver o foco ao botão de ajuda tiraria o foco do balão do tour.
          event.preventDefault();
          startTour(buildTourSteps(pendingTour));
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            {view === "home" ? (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[0.65rem] bg-primary-soft text-primary">
                <CircleQuestionMark className="size-5" />
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="-ml-2 shrink-0"
                onClick={() => setView("home")}
                aria-label="Voltar para a central de ajuda"
              >
                <ChevronLeft className="size-5" />
              </Button>
            )}
            <div className="min-w-0">
              <DialogTitle>
                {view === "home" ? "Central de ajuda" : VIEW_TITLES[view]}
              </DialogTitle>
              <DialogDescription>
                {page ? (
                  <>
                    Nesta tela:{" "}
                    <span className="font-medium text-foreground">
                      {page.title}
                    </span>
                  </>
                ) : (
                  "Dicas e referência do Recomenda"
                )}
              </DialogDescription>
            </div>
          </div>
          {view === "home" ? (
            // O header reserva espaço à direita para o X; a busca fica abaixo
            // dele e pode ir até a margem.
            <div className="relative mt-2 -mr-8">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar na ajuda…"
                aria-label="Buscar na ajuda"
                autoComplete="off"
                className="h-10 pl-9"
              />
            </div>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {view === "home" ? (
            <p className="sr-only" aria-live="polite">
              {searching
                ? resultCount === 1
                  ? "1 resultado"
                  : `${resultCount} resultados`
                : ""}
            </p>
          ) : null}

          {view === "home" && !results ? (
            <div className="space-y-5">
              <OptionGroup label="Nesta tela">
                {options
                  .filter((option) => option.group === "page")
                  .map((option) => (
                    <HelpOption key={option.key} option={option} />
                  ))}
              </OptionGroup>
              <OptionGroup label="Para consultar">
                {options
                  .filter((option) => option.group === "reference")
                  .map((option) => (
                    <HelpOption key={option.key} option={option} />
                  ))}
              </OptionGroup>
            </div>
          ) : null}

          {results ? (
            resultCount === 0 ? (
              <EmptyNotice>
                Nada encontrado para “{query.trim()}”. Tente outra palavra ou
                só o começo dela.
              </EmptyNotice>
            ) : (
              <div className="space-y-6">
                {results.options.length > 0 ? (
                  <OptionGroup label="Na central de ajuda">
                    {results.options.map((option) => (
                      <HelpOption
                        key={option.key}
                        option={option}
                        terms={terms}
                      />
                    ))}
                  </OptionGroup>
                ) : null}
                {results.spots.length > 0 ? (
                  <OptionGroup label="Mostrar na tela">
                    {results.spots.map((option) => (
                      <HelpOption
                        key={option.key}
                        option={option}
                        terms={terms}
                      />
                    ))}
                  </OptionGroup>
                ) : null}
                {results.docs.length > 0 ? (
                  <ContentGroup label="Documentação" className="px-2.5">
                    <Sections sections={results.docs} terms={terms} />
                  </ContentGroup>
                ) : null}
                {results.formulas.length > 0 ? (
                  <ContentGroup label="Fórmulas e cálculos" className="px-2.5">
                    <Formulas formulas={results.formulas} terms={terms} />
                  </ContentGroup>
                ) : null}
                {results.faq.length > 0 ? (
                  <ContentGroup label="Perguntas frequentes" className="px-2.5">
                    <Faq items={results.faq} terms={terms} open />
                  </ContentGroup>
                ) : null}
                {results.glossary.length > 0 ? (
                  <ContentGroup label="Glossário" className="px-2.5">
                    <Glossary items={results.glossary} terms={terms} />
                  </ContentGroup>
                ) : null}
                {results.shortcuts.length > 0 ? (
                  <ContentGroup
                    label="Atalhos de teclado"
                    className="px-2.5 max-sm:hidden"
                  >
                    <Shortcuts items={results.shortcuts} terms={terms} />
                  </ContentGroup>
                ) : null}
              </div>
            )
          ) : null}

          {view === "docs" ? (
            <div className="space-y-6">
              {page?.summary ? (
                <p className="text-sm leading-relaxed text-foreground">
                  {page.summary}
                </p>
              ) : null}
              {pageDocs.length > 0 ? (
                <ContentGroup label="Sobre esta tela">
                  <Sections sections={pageDocs} />
                </ContentGroup>
              ) : (
                <EmptyNotice>
                  Esta tela ainda não tem documentação própria. Abaixo, o guia
                  geral do Recomenda.
                </EmptyNotice>
              )}
              <ContentGroup label="Guia geral">
                <Sections sections={guide} />
              </ContentGroup>
            </div>
          ) : null}

          {view === "formulas" ? (
            <div className="space-y-6">
              {pageFormulas.length > 0 ? (
                <ContentGroup label="Desta tela">
                  <Formulas formulas={pageFormulas} />
                </ContentGroup>
              ) : (
                <EmptyNotice>
                  Esta tela ainda não tem cálculos documentados. Abaixo, as
                  contas que aparecem em várias telas do Recomenda.
                </EmptyNotice>
              )}
              {formulas.length > 0 ? (
                <ContentGroup label="Cálculos gerais">
                  <Formulas formulas={formulas} />
                </ContentGroup>
              ) : null}
            </div>
          ) : null}

          {view === "glossary" ? <Glossary items={glossary()} /> : null}

          {view === "faq" ? (
            <div className="space-y-6">
              {pageFaq.length > 0 ? (
                <ContentGroup label="Desta tela">
                  <Faq items={pageFaq} />
                </ContentGroup>
              ) : null}
              <ContentGroup label={pageFaq.length > 0 ? "Gerais" : undefined}>
                <Faq items={faq} />
              </ContentGroup>
            </div>
          ) : null}

          {view === "shortcuts" ? (
            <div className="space-y-3">
              <Shortcuts items={keyboard} />
              <p className="text-xs text-muted-foreground">
                No Windows e no Linux, use Ctrl no lugar de ⌘.
              </p>
            </div>
          ) : null}
        </div>

        {SHOW_CONTACT ? (
          <DialogFooter className="flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Não encontrou o que precisava?
            </p>
            <Button asChild variant="outline" size="sm">
              <a href={supportMailto(page?.title ?? null, pathname)}>
                <Mail />
                Falar com a 250k
              </a>
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** E-mail de contato já com a tela no assunto — quem responde sabe de onde veio. */
function supportMailto(pageTitle: string | null, pathname: string): string {
  const subject = `Ajuda no Recomenda — ${pageTitle ?? "dúvida"}`;
  const body = `Tela: ${pathname}\n\nMinha dúvida:\n`;
  return `mailto:${links.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function OptionGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section>
      <p className="px-2.5 pb-1 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
        {label}
      </p>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function HelpOption({
  option: { icon: Icon, title, description, action = "open", onClick, className },
  terms = NO_TERMS,
}: {
  option: HelpOptionItem;
  terms?: string[];
}) {
  const Trailing = action === "play" ? Play : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[0.6rem] bg-primary-soft text-primary">
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text-strong">
          {highlightText(title, terms)}
        </span>
        <span className="mt-px block text-xs leading-snug text-muted-foreground">
          {highlightText(description, terms)}
        </span>
      </span>
      <Trailing
        className={cn(
          "size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5",
          action === "play" && "fill-current",
        )}
      />
    </button>
  );
}

function ContentGroup({
  label,
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      {label ? (
        <p className="pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
          {label}
        </p>
      ) : null}
      {children}
    </section>
  );
}

function EmptyNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-dashed border-border bg-muted/40 px-3.5 py-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function Sections({
  sections,
  terms = NO_TERMS,
}: {
  sections: HelpSection[];
  terms?: string[];
}) {
  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <article key={section.title}>
          <h3 className="font-display text-[0.95rem] font-semibold text-text-strong">
            {highlightText(section.title, terms)}
          </h3>
          <div className="mt-1.5 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {highlightNode(section.body, terms)}
          </div>
        </article>
      ))}
    </div>
  );
}

function Formulas({
  formulas,
  terms = NO_TERMS,
}: {
  formulas: HelpFormula[];
  terms?: string[];
}) {
  return (
    <div className="space-y-3">
      {formulas.map((formula) => (
        <article
          key={formula.name}
          className="rounded-xl border border-border bg-card p-4"
        >
          <h3 className="text-sm font-semibold text-text-strong">
            {highlightText(formula.name, terms)}
          </h3>
          <div className="mt-2 space-y-1 rounded-lg bg-muted px-3 py-2.5 font-mono text-[0.8rem] leading-relaxed text-foreground">
            {formula.expressions.map((expression) => (
              <p key={expression}>{highlightText(expression, terms)}</p>
            ))}
          </div>
          {formula.description ? (
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              {highlightNode(formula.description, terms)}
            </p>
          ) : null}
          {formula.example ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Exemplo: </span>
              {highlightText(formula.example, terms)}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function Faq({
  items,
  terms = NO_TERMS,
  open = false,
}: {
  items: HelpFaqItem[];
  terms?: string[];
  /** Na busca, a resposta já vem aberta — o trecho que bateu pode estar nela. */
  open?: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <details
          key={item.question}
          open={open}
          className="group rounded-xl border border-border bg-card px-4 py-3 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-sm font-semibold text-text-strong outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <span>{highlightText(item.question, terms)}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {highlightNode(item.answer, terms)}
          </div>
        </details>
      ))}
    </div>
  );
}

function Glossary({
  items,
  terms = NO_TERMS,
}: {
  items: HelpGlossaryTerm[];
  terms?: string[];
}) {
  return (
    <dl className="divide-y divide-border">
      {items.map((item) => (
        <div key={item.term} className="py-3 first:pt-0 last:pb-0">
          <dt className="text-sm font-semibold text-text-strong">
            {highlightText(item.term, terms)}
          </dt>
          <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            {highlightNode(item.definition, terms)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Shortcuts({
  items,
  terms = NO_TERMS,
}: {
  items: HelpShortcut[];
  terms?: string[];
}) {
  return (
    <ul className="divide-y divide-border">
      {items.map((shortcut) => (
        <li
          key={shortcut.description}
          className="flex items-center justify-between gap-4 py-2.5 text-sm text-foreground"
        >
          <span>{highlightText(shortcut.description, terms)}</span>
          <span className="flex shrink-0 items-center gap-1">
            {shortcut.keys.map((key) => (
              <kbd
                key={key}
                className="min-w-6 rounded border border-border bg-muted px-1.5 py-0.5 text-center font-sans text-xs font-medium text-muted-foreground"
              >
                {key}
              </kbd>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
