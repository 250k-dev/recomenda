"use client";

import { usePathname } from "next/navigation";

/**
 * Prefixa âncoras com `/` fora da home, para o header/footer funcionarem
 * em páginas como `/privacidade`.
 */
export function useLandingHref() {
  const pathname = usePathname();
  const onHome = pathname === "/";

  return (href: string) => {
    if (href.startsWith("#") && !onHome) return `/${href}`;
    return href;
  };
}
