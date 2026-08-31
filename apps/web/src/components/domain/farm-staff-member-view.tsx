"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";
import { toast } from "sonner";
import { routes } from "@recomenda/config";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { FarmStaffGrantsPalette } from "@/components/domain/farm-staff-grants-palette";
import { PageHero } from "@/components/domain/page-hero";
import { Button } from "@recomenda/ui/primitives/button";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { useUpdateFarmTeamGrants } from "@recomenda/api-hooks";
import type { FarmTeamMember } from "@recomenda/api/farm-team";
import type { AccessLevel } from "@recomenda/api/auth-types";
import {
  FARM_STAFF_GRANT_KEYS,
  type FarmStaffGrantKey,
} from "@recomenda/domain";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function unionGrantKeys(memberships: FarmTeamMember[]): FarmStaffGrantKey[] {
  const set = new Set<string>();
  for (const m of memberships) {
    for (const k of m.permission_grants ?? []) set.add(k);
    if (m.can_view_prices) set.add("prices");
  }
  return FARM_STAFF_GRANT_KEYS.filter((k) => set.has(k));
}

export function FarmStaffMemberView({
  userId,
  memberships,
}: {
  userId: string;
  memberships: FarmTeamMember[];
}) {
  const first = memberships[0];
  const level = (memberships.some((m) => m.access_level === "FARM_MANAGER")
    ? "FARM_MANAGER"
    : "FARM_OPERATOR") as Extract<AccessLevel, "FARM_MANAGER" | "FARM_OPERATOR">;
  const [grantKeys, setGrantKeys] = useState<FarmStaffGrantKey[]>(() =>
    unionGrantKeys(memberships),
  );
  const save = useUpdateFarmTeamGrants();
  const name = first?.name ?? "—";
  const email = first?.email ?? "—";
  const savedKeys = useMemo(() => unionGrantKeys(memberships), [memberships]);
  const savedKeySig = savedKeys.join("|");
  useEffect(() => {
    setGrantKeys(savedKeys);
    // savedKeySig: recarrega quando o servidor devolve grants novos após salvar.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- savedKeys deriva de savedKeySig
  }, [savedKeySig]);
  const dirty =
    grantKeys.length !== savedKeys.length ||
    grantKeys.some((k) => !savedKeys.includes(k));

  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
      <BreadcrumbBack items={[{ label: "Equipe", href: routes.equipe.lista }]} />
      <PageHero
        icon={<Users className="size-6" />}
        eyebrow="Equipe da fazenda"
        title={name}
        titleBadge={
          <span className="text-xs text-muted-foreground">
            {level === "FARM_MANAGER" ? "Gerente" : "Operador"}
          </span>
        }
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link href={routes.equipe.auditoria({ actor: userId })}>
              Trilha
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        }
      >
        <div className="mt-3 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-strong">
            {initials(name)}
          </span>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </PageHero>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-[#2B2723]">Produtores</h2>
        <p className="mt-1 text-[13px] text-[#8A857D]">
          Vínculos desta pessoa. As permissões abaixo valem para todos.
        </p>
        <ul className="mt-3 divide-y rounded-lg border border-[#EDE7DC]">
          {memberships.map((m) => (
            <li key={m.id} className="px-4 py-2.5 text-sm text-[#2B2723]">
              {m.producer_name || "—"}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <FarmStaffGrantsPalette
          level={level}
          selected={grantKeys}
          onChange={setGrantKeys}
        />
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          <p className="mr-auto text-[13px] text-[#8A857D]">
            A pessoa precisa sair e entrar de novo para o acesso atualizar.
          </p>
          <Button
            disabled={!dirty || save.isPending}
            onClick={async () => {
              try {
                await save.mutateAsync({ userId, grant_keys: grantKeys });
                toast.success("Permissões salvas.");
              } catch (e) {
                toast.error(apiErrorMessage(e, "Não foi possível salvar."));
              }
            }}
          >
            {save.isPending ? "Salvando…" : "Salvar permissões"}
          </Button>
        </div>
      </section>
    </div>
  );
}
