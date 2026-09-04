"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { FarmPurchaseListTab } from "@/components/domain/farm-purchase-list-tab";
import {
  CyclePageShell,
  useCyclePage,
} from "@/components/domain/cycle/cycle-page-shell";
import { useCyclePurchaseList } from "@recomenda/api-hooks";
import { useCan } from "@recomenda/api-hooks/use-can";

/** Lista de compra da safra da fazenda (era `?tab=purchase` na safra). */
export default function CyclePurchaseListPage() {
  const router = useRouter();
  const canListCrud = useCan("LIST_CRUD");
  const page = useCyclePage();
  const { farmId, producerId } = page;

  const {
    data: purchaseList,
    isLoading: loadingList,
    isError: listError,
    refetch: refetchList,
  } = useCyclePurchaseList(page.cycleId);

  // Lista em rascunho: abrir esta tela retoma o wizard direto (continua o
  // fluxo de onde parou), sem tela intermediária. Ao finalizar vira `active` e
  // esta tela mostra a lista normal; ao salvar rascunho voltamos para a safra,
  // então não há loop.
  const listIsDraft = purchaseList?.status === "draft";
  useEffect(() => {
    if (listIsDraft) {
      router.replace(page.hrefs.novaListaDeCompra);
    }
  }, [listIsDraft, page.hrefs.novaListaDeCompra, router]);

  return (
    <CyclePageShell page={page} backHref={page.hrefs.base}>
      {loadingList ? (
        <EmptyState
          icon={ShoppingCart}
          title="Carregando a lista de compra…"
          description="Buscando se esta safra já tem lista ou rascunho."
        />
      ) : listError ? (
        <EmptyState
          icon={ShoppingCart}
          title="Não foi possível abrir a lista de compra."
          description="Tente de novo. Se o rascunho já estiver salvo, ele continua no servidor."
          action={
            <Button size="sm" variant="outline" onClick={() => void refetchList()}>
              Tentar de novo
            </Button>
          }
        />
      ) : purchaseList == null ? (
        <EmptyState
          icon={ShoppingCart}
          title="Esta safra ainda não tem lista de compra."
          description="Monte a lista com tudo que a safra vai precisar — soja e milho juntos — e entregue ao produtor antes mesmo de montar a programação."
          action={
            canListCrud ? (
              <Button asChild size="sm" className="gap-1.5">
                <Link href={page.hrefs.novaListaDeCompra}>
                  <Plus className="size-4" />
                  Montar lista de compra
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : listIsDraft ? (
        // Rascunho em andamento: o efeito acima já redireciona para o wizard
        // (continua o fluxo). Este é só o estado enquanto o redirect acontece.
        <EmptyState
          icon={ShoppingCart}
          title="Retomando o rascunho da lista…"
          description="Abrindo a lista de compra de onde você parou."
          action={
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href={page.hrefs.novaListaDeCompra}>
                <ShoppingCart className="size-4" />
                Continuar rascunho
              </Link>
            </Button>
          }
        />
      ) : (
        <FarmPurchaseListTab
          farmId={farmId}
          list={purchaseList ?? null}
          purchaseLists={purchaseList ? [purchaseList] : []}
          selectedListId={purchaseList?.id ?? ""}
          onSelectList={() => {}}
          isLoading={loadingList}
          producerId={producerId || null}
          newPurchaseListHref={page.hrefs.novaListaDeCompra}
          fallbackSeasonIds={[]}
          onOpenCostPlan={() => router.push(page.hrefs.planoDeCusto)}
          stockHref={page.hrefs.estoque}
        />
      )}
    </CyclePageShell>
  );
}
