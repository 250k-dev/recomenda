"use client";

import { MessageCircle } from "lucide-react";
import { PageHero } from "@/components/domain/page-hero";
import { Badge } from "@recomenda/ui/primitives/badge";
import { useLicoRoster } from "@recomenda/api-hooks";
import { formatPhoneBR } from "@recomenda/utils";

const ROLE_LABEL = {
  agronomist: "Agrônomo",
  team: "Equipe",
  producer: "Produtor",
} as const;

export default function LicoRosterPage() {
  const { data, isLoading, isError } = useLicoRoster();

  const status = !data
    ? "Carregando"
    : data.enabled
      ? "Ligado"
      : "Desligado";

  const detail = !data
    ? "Consultando a conta."
    : data.source === "premium"
      ? `Incluso no plano ${data.planName}. Produtores e equipe desta carteira podem usar o WhatsApp.`
      : data.source === "addon"
        ? "Ativo como complemento. Produtores e equipe desta carteira podem usar o WhatsApp."
        : "Desligado nesta conta. Quem está na lista abaixo não é atendido pelo Lico até o complemento ou o Premium.";

  return (
    <>
      <PageHero
        variant="inverted"
        icon={<MessageCircle className="size-6" />}
        eyebrow="WhatsApp"
        title="Lico"
        titleBadge={<Badge variant="neutral">{status}</Badge>}
      />

      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{detail}</p>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Carregando pessoas da carteira…</p>
        ) : isError ? (
          <p className="p-5 text-sm text-destructive">Não foi possível carregar o Lico desta conta.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data?.people.map((person) => (
              <li key={person.userId} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-text-strong">{person.name}</p>
                  <p className="text-sm text-muted-foreground">{ROLE_LABEL[person.role]}</p>
                </div>
                <div className="text-sm text-muted-foreground sm:text-right">
                  <p>{formatPhoneBR(person.phone, "Sem telefone")}</p>
                  <p>{person.whatsappLinked ? "WhatsApp vinculado" : "Sem vínculo no WhatsApp"}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
