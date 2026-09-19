"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";

const SENTINEL = "__recomendaLeaveGuard";

export type LeaveBusyController = {
  isBusy: () => boolean;
  flush: () => Promise<boolean>;
  setLeaveUi: (open: boolean) => void;
};

let registered: LeaveBusyController | null = null;

export async function runLeaveBusy(proceed: () => void) {
  const guard = registered;
  if (!guard?.isBusy()) {
    proceed();
    return;
  }
  guard.setLeaveUi(true);
  const ok = await guard.flush();
  guard.setLeaveUi(false);
  if (ok) proceed();
}

function destinationIfLeaving(
  anchor: HTMLAnchorElement,
): string | null {
  if (anchor.target && anchor.target !== "_self") return null;
  const raw = anchor.getAttribute("href");
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
    return null;
  }
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  ) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Enquanto `enabled`, intercepta Link interno (header, abas) e o voltar do
 * navegador: mostra a UI de “salvando” via controller, espera o flush, só então sai.
 */
export function useLeaveBusyGuard(controller: LeaveBusyController, enabled: boolean) {
  const pathname = usePathname();
  const router = useRouter();
  const controllerRef = useRef(controller);
  controllerRef.current = controller;
  const ignorePopRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      registered = null;
      return;
    }
    registered = {
      isBusy: () => controllerRef.current.isBusy(),
      flush: () => controllerRef.current.flush(),
      setLeaveUi: (open) => controllerRef.current.setLeaveUi(open),
    };
    return () => {
      registered = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!controllerRef.current.isBusy()) return;
      const dest = destinationIfLeaving(anchor);
      if (!dest) return;
      event.preventDefault();
      event.stopPropagation();
      void (async () => {
        controllerRef.current.setLeaveUi(true);
        const ok = await controllerRef.current.flush();
        controllerRef.current.setLeaveUi(false);
        if (ok) router.push(dest as Route);
      })();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled, pathname, router]);

  useEffect(() => {
    if (!enabled) return;
    window.history.pushState({ [SENTINEL]: true }, "", window.location.href);

    const onPopState = () => {
      if (ignorePopRef.current) {
        ignorePopRef.current = false;
        return;
      }
      if (!controllerRef.current.isBusy()) return;
      window.history.pushState({ [SENTINEL]: true }, "", window.location.href);
      void (async () => {
        controllerRef.current.setLeaveUi(true);
        const ok = await controllerRef.current.flush();
        controllerRef.current.setLeaveUi(false);
        if (ok) {
          ignorePopRef.current = true;
          window.history.go(-2);
        }
      })();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      const state = window.history.state as { [SENTINEL]?: boolean } | null;
      if (state?.[SENTINEL]) {
        ignorePopRef.current = true;
        window.history.back();
      }
    };
  }, [enabled]);
}
