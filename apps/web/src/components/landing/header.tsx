"use client";

import { useEffect, useState } from "react";
import { nav, links } from "./content";
import { Button, Container, Wordmark, cn } from "./primitives";
import { Close, Menu } from "./icons";
import { useLandingHref } from "./use-landing-href";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const hrefFor = useLandingHref();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300",
        scrolled || open
          ? "border-b border-line bg-cream/85 shadow-soft backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-4 sm:h-[4.5rem]">
        <a href="/" aria-label="Recomenda — início" className="shrink-0">
          <Wordmark />
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
          {nav.map((item) => (
            <a
              key={item.href}
              href={hrefFor(item.href)}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/[0.05] hover:text-brand-700"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button href={links.appUrl} variant="ghost" size="sm">
            Entrar
          </Button>
          <Button href={hrefFor(links.subscribe)} variant="primary" size="sm" withArrow>
            Assinar
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="menu-principal"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-ink/[0.06] md:hidden"
        >
          {open ? <Close /> : <Menu />}
        </button>
      </Container>

      <div
        id="menu-principal"
        className={cn(
          "overflow-hidden border-t border-line bg-cream/95 backdrop-blur-md transition-[max-height,opacity] duration-300 md:hidden",
          open ? "max-h-[26rem] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <Container className="flex flex-col gap-1 py-4">
          {nav.map((item) => (
            <a
              key={item.href}
              href={hrefFor(item.href)}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-base font-medium text-ink/80 transition-colors hover:bg-ink/[0.05] hover:text-brand-700"
            >
              {item.label}
            </a>
          ))}
          <div className="mt-2 flex flex-col gap-2">
            <Button
              href={links.appUrl}
              variant="outline"
              size="md"
              onClick={() => setOpen(false)}
            >
              Entrar na plataforma
            </Button>
            <Button
              href={hrefFor(links.subscribe)}
              variant="primary"
              size="md"
              withArrow
              onClick={() => setOpen(false)}
            >
              Assinar a Recomenda
            </Button>
          </div>
        </Container>
      </div>
    </header>
  );
}
