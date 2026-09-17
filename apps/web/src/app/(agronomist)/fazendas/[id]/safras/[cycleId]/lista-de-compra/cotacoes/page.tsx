"use client";

import Link from "next/link";
import { ShoppingCart, Store } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { PageHero } from "@/components/domain/page-hero";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { QuoteComparisonSection } from "@/components/domain/quote-comparison-section";
import { QuoteShareButton } from "@/components/domain/quote-share-button";
import {
  CyclePageShell,
  useCyclePage,
} from "@/components/domain/cycle/cycle-page-shell";
import { useCyclePurchaseList } from "@recomenda/api-hooks";
import { useCan } from "@recomenda/api-hooks/use-can";

/** Cotações das lojas da lista de compra da safra (era uma seção no fim da lista). */
export default function CyclePurchaseListQuotesPage() {
  const canQuoteCrud = useCan("QUOTE_CRUD");
  const page = useCyclePage();

  const {
    data: purchaseList,
    isLoading,
    isError,
    refetch,
  } = useCyclePurchaseList(page.cycleId);

  return (
    <CyclePageShell
      page={page}
      backHref={page.hrefs.listaDeCompra}
      hideHero
      trail={[
        { label: "Lista de compra", href: page.hrefs.listaDeCompra },
        { label: "Cotações" },
      ]}
    >
      {!canQuoteCrud ? (
        <EmptyState
          icon={Store}
          title="Sem permissão para ver as cotações."
          description="Só quem gerencia cotações compartilha a lista com as lojas e compara os preços."
        />
      ) : isLoading ? (
        <TableRowsSkeleton rows={5} columns={4} />
      ) : isError ? (
        <EmptyState
          icon={Store}
          title="Não foi possível abrir as cotações."
          action={
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : purchaseList == null ? (
        <EmptyState
          icon={ShoppingCart}
          title="Esta safra ainda não tem lista de compra."
          description="Monte a lista de compra para compartilhar com as lojas e receber cotações."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href={page.hrefs.listaDeCompra}>Ir para a lista de compra</Link>
            </Button>
          }
        />
      ) : (
        <>
          <PageHero
            className="mb-7"
            icon={<Store className="size-6" />}
            eyebrow={`Lista de compra · ${purchaseList.name}`}
            title="Cotações"
            actions={
              <QuoteShareButton
                listId={purchaseList.id}
                listName={purchaseList.name}
              />
            }
          >
            <p className="mt-3 text-sm text-muted-foreground">
              Preços por loja — somente você vê esta comparação.
            </p>
          </PageHero>

          <QuoteComparisonSection listId={purchaseList.id} />
        </>
      )}
    </CyclePageShell>
  );
}
