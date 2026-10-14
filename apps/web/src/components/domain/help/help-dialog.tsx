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
  Mail,
  MessageCircleQuestionMark,
  Play,
  Route as RouteIcon,
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
import { buildTourSteps } from "./help-tour";
import { resolvePageHelp } from "./registry";
import type {
  HelpContext,
  HelpFaqItem,
  HelpFormula,
  HelpSection,
  HelpShell,
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
  // Tour escolhido no modal: só começa depois que ele termina de fechar, senão
  // o foco e o overlay do Dialog brigam com os do tour.
  const pendingTour = useRef<HelpTourStep[] | null>(null);

  const pageTour = page?.tour ?? [];
  const pageDocs = page?.docs ?? [];
  const pageFormulas = page?.formulas ?? [];
  const pageFaq = page?.faq ?? [];
  const guide = generalGuide(ctx);
  const formulas = generalFormulas(ctx);
  const faq = generalFaq(ctx);
  const keyboard = shortcuts(ctx);

  const launchTour = (steps: HelpTourStep[]) => {
    pendingTour.current = steps;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl"
        onCloseAutoFocus={(event) => {
          setView("home");
          const steps = pendingTour.current;
          if (!steps) return;
          pendingTour.current = null;
          // Devolver o foco ao botão de ajuda tiraria o foco do balão do tour.
          event.preventDefault();
          startTour(buildTourSteps(steps));
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
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {view === "home" ? (
            <div className="space-y-5">
              <OptionGroup label="Nesta tela">
                {pageTour.length > 0 ? (
                  <HelpOption
                    icon={RouteIcon}
                    title="Tour desta tela"
                    description="Os elementos desta tela, um de cada vez."
                    action="play"
                    onClick={() => launchTour(pageTour)}
                  />
                ) : null}
                <HelpOption
                  icon={Compass}
                  title="Tour da interface"
                  description={
                    shell === "admin"
                      ? "Menu, notificações e perfil — o que está em toda tela."
                      : "Trilha, busca, notificações e menu — o que está em toda tela."
                  }
                  action="play"
                  onClick={() => launchTour(interfaceTour(ctx))}
                />
                <HelpOption
                  icon={BookOpen}
                  title="Documentação"
                  description={
                    pageDocs.length > 0
                      ? "Como esta tela funciona, parte por parte."
                      : "Guia geral de uso do Recomenda."
                  }
                  onClick={() => setView("docs")}
                />
                {pageFormulas.length + formulas.length > 0 ? (
                  <HelpOption
                    icon={Calculator}
                    title="Fórmulas e cálculos"
                    description={
                      pageFormulas.length > 0
                        ? "Como os números desta tela são calculados."
                        : "DAP, janela, receita, dólar e sacas — as contas do dia a dia."
                    }
                    onClick={() => setView("formulas")}
                  />
                ) : null}
              </OptionGroup>

              <OptionGroup label="Para consultar">
                <HelpOption
                  icon={BookA}
                  title="Glossário"
                  description="Safra, talhão, etapa, DAP e outros termos."
                  onClick={() => setView("glossary")}
                />
                <HelpOption
                  icon={MessageCircleQuestionMark}
                  title="Perguntas frequentes"
                  description="Respostas rápidas para as dúvidas mais comuns."
                  onClick={() => setView("faq")}
                />
                {/* Sem teclado físico no celular, a lista só ocupa espaço. */}
                <HelpOption
                  icon={Keyboard}
                  title="Atalhos de teclado"
                  description="Para quem prefere não tirar a mão do teclado."
                  onClick={() => setView("shortcuts")}
                  className="max-sm:hidden"
                />
              </OptionGroup>
            </div>
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

          {view === "glossary" ? (
            <dl className="divide-y divide-border">
              {glossary().map((item) => (
                <div key={item.term} className="py-3 first:pt-0 last:pb-0">
                  <dt className="text-sm font-semibold text-text-strong">
                    {item.term}
                  </dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {item.definition}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

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
              <ul className="divide-y divide-border">
                {keyboard.map((shortcut) => (
                  <li
                    key={shortcut.description}
                    className="flex items-center justify-between gap-4 py-2.5 text-sm text-foreground"
                  >
                    <span>{shortcut.description}</span>
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
              <p className="text-xs text-muted-foreground">
                No Windows e no Linux, use Ctrl no lugar de ⌘.
              </p>
            </div>
          ) : null}
        </div>

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
  icon: Icon,
  title,
  description,
  action = "open",
  onClick,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** `play` inicia algo (tour); `open` navega para uma seção do modal. */
  action?: "open" | "play";
  onClick: () => void;
  className?: string;
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
          {title}
        </span>
        <span className="mt-px block text-xs leading-snug text-muted-foreground">
          {description}
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
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <section>
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

function Sections({ sections }: { sections: HelpSection[] }) {
  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <article key={section.title}>
          <h3 className="font-display text-[0.95rem] font-semibold text-text-strong">
            {section.title}
          </h3>
          <div className="mt-1.5 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {section.body}
          </div>
        </article>
      ))}
    </div>
  );
}

function Formulas({ formulas }: { formulas: HelpFormula[] }) {
  return (
    <div className="space-y-3">
      {formulas.map((formula) => (
        <article
          key={formula.name}
          className="rounded-xl border border-border bg-card p-4"
        >
          <h3 className="text-sm font-semibold text-text-strong">
            {formula.name}
          </h3>
          <div className="mt-2 space-y-1 rounded-lg bg-muted px-3 py-2.5 font-mono text-[0.8rem] leading-relaxed text-foreground">
            {formula.expressions.map((expression) => (
              <p key={expression}>{expression}</p>
            ))}
          </div>
          {formula.description ? (
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              {formula.description}
            </p>
          ) : null}
          {formula.example ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Exemplo: </span>
              {formula.example}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function Faq({ items }: { items: HelpFaqItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <details
          key={item.question}
          className="group rounded-xl border border-border bg-card px-4 py-3 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-sm font-semibold text-text-strong outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {item.question}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
