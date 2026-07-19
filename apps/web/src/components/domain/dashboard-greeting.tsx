"use client";

import { useSyncExternalStore } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useMe } from "@recomenda/api-hooks";

// Saudação pelo relógio local do usuário, só no cliente: no SSR o fuso é o do
// servidor, então lá cai no "Olá" neutro para não hidratar com valor errado.
const subscribeNoop = () => () => {};
const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
};

/** Saudação do Dashboard, exibida na linha do header ao lado da busca e do menu. */
export function DashboardGreeting() {
  const { data: me } = useMe();
  const salute = useSyncExternalStore(subscribeNoop, getGreeting, () => "Olá");

  const firstName = me?.name?.trim().split(/\s+/)[0] ?? "";
  const dateLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="min-w-0">
      <p className="truncate font-display text-[11px] font-bold uppercase tracking-[0.12em] text-primary-strong">
        {dateLabel}
      </p>
      <h1 className="truncate font-display text-xl font-semibold tracking-[-0.02em] text-text-strong md:text-2xl">
        {salute}
        {firstName ? `, ${firstName}` : ""}
      </h1>
    </div>
  );
}
