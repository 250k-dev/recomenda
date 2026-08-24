"use client";

import { Logo250K } from "@/assets/logo-250K";
import { links, nav } from "./content";
import { Container, Wordmark } from "./primitives";
import { useLandingHref } from "./use-landing-href";

const year = new Date().getFullYear();

export function Footer() {
  const hrefFor = useLandingHref();

  const columns = [
    {
      title: "Produto",
      items: nav.map((n) => ({ label: n.label, href: hrefFor(n.href) })),
    },
    {
      title: "Acesso",
      items: [
        { label: "Entrar na plataforma", href: links.appUrl },
        { label: "Assinar a Recomenda", href: hrefFor(links.subscribe) },
        { label: "Política de privacidade", href: links.privacy },
        { label: "Termos de uso", href: links.terms },
      ],
    },
    {
      title: "Contato",
      items: [
        { label: links.contactEmail, href: `mailto:${links.contactEmail}` },
        { label: "Falar com a 250k", href: `mailto:${links.contactEmail}` },
      ],
    },
  ];

  return (
    <footer className="bg-brand-950 text-brand-100/75">
      <Container className="py-16">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <a href="/" aria-label="Recomenda — início">
              <Wordmark tone="light" />
            </a>
            <p className="mt-4 text-sm leading-relaxed text-brand-100/65">
              A recomendação agrícola no tempo certo, do plantio à colheita. Para
              agrônomos, equipes e produtores.
            </p>
            <div className="mt-6 flex items-center gap-2.5">
              <Logo250K width={22} height={30} fill="#dcefe3" aria-hidden />
              <span className="text-sm font-medium text-brand-100/80">
                Uma solução 250k
              </span>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-100/45">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-sm text-brand-100/75 transition-colors hover:text-white"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-7 text-sm text-brand-100/55 sm:flex-row">
          <p>© {year} Recomenda · 250k. Todos os direitos reservados.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a href={links.privacy} className="transition-colors hover:text-white">
              Política de privacidade
            </a>
            <a href={links.terms} className="transition-colors hover:text-white">
              Termos de uso
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
