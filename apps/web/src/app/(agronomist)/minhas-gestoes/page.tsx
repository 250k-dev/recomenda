"use client";

import { Briefcase } from "lucide-react";
import {
  useActiveScope,
  useExitContext,
  useMemberships,
  useSwitchContext,
} from "@recomenda/api-hooks";
import { Button } from "@recomenda/ui/primitives/button";
import { Card, CardContent } from "@recomenda/ui/primitives/card";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { PageHeader } from "@/components/domain/page-header";

export default function MinhasGestoesPage() {
  const { data: memberships, isLoading } = useMemberships();
  const activeScope = useActiveScope();
  const switchMutation = useSwitchContext();
  const exitMutation = useExitContext();

  const list = memberships?.memberships ?? [];
  const isPending = switchMutation.isPending || exitMutation.isPending;

  return (
    <>
      <PageHeader
        icon={<Briefcase className="size-5" />}
        section="Carteiras"
        title="Minhas Gestões"
        description="Carteiras de outros agrônomos onde você atua como gestor ou consultor. Entre em uma carteira para operá-la; volte para a sua quando quiser."
      />

      {!isLoading && list.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Você ainda não gerencia outras carteiras"
          description="Quando um agrônomo convidar você como gestor ou consultor, a carteira aparecerá aqui."
        />
      ) : null}

      {list.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((membership) => {
            const isActive = activeScope?.agronomist_id === membership.agronomist_id;
            const levelLabel =
              membership.access_level === "MANAGER" ? "Gestor" : "Consultor";
            return (
              <Card key={membership.agronomist_id} className={isActive ? "border-primary" : undefined}>
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
                      <Briefcase className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{membership.agronomist_name}</p>
                      <p className="text-xs text-muted-foreground">{levelLabel}</p>
                    </div>
                  </div>
                  {isActive ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isPending}
                      onClick={() => exitMutation.mutate()}
                    >
                      Sair
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => switchMutation.mutate(membership.agronomist_id)}
                    >
                      Entrar
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
