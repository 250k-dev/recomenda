"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileDown, Loader2, PencilLine, RotateCcw, Share2, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@recomenda/ui/primitives/button";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import {
  usePurchaseListQuoteTrash,
  usePurchaseListQuotes,
  useQuoteTrashActions,
} from "@recomenda/api-hooks";
import { queryKeys } from "@recomenda/api-hooks/queryKeys";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { QuoteExportDialog } from "@/components/domain/quote-export-dialog";
import {
  createQuoteRequest,
  createQuoteResponse,
  type QuoteAvailability,
  type QuoteComparisonResponse,
  type QuotePaymentTerm,
} from "@recomenda/api/quotes";

const fmtQty = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

const AVAILABILITY_LABEL: Record<QuoteAvailability, string> = {
  AVAILABLE: "Tem",
  UNAVAILABLE: "Não tem",
  PARTIAL: "Parcial",
};

const PAYMENT_TERM_LABEL: Record<QuotePaymentTerm, string> = {
  CASH: "À vista",
  TERM: "A prazo",
};

function statusBadge(r: QuoteComparisonResponse) {
  return r.status === "SUBMITTED" ? (
    <StatusBadge tone="success">Enviada</StatusBadge>
  ) : (
    <StatusBadge tone="warning">Em preenchimento</StatusBadge>
  );
}

/** Alvo de uma exclusão definitiva (irreversível), confirmada por diálogo. */
type PendingPermanent =
  | { kind: "response"; responseId: string; label: string }
  | { kind: "item"; responseId: string; itemId: string; label: string };

export function QuoteComparisonSection({
  listId,
  listName,
  producerName,
  agronomistName,
}: {
  listId: string;
  listName?: string | null;
  producerName?: string | null;
  agronomistName?: string | null;
}) {
  const { data, isLoading } = usePurchaseListQuotes(listId);
  const { data: trash } = usePurchaseListQuoteTrash(listId);
  const actions = useQuoteTrashActions(listId);
  const queryClient = useQueryClient();

  const [showTrash, setShowTrash] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingPermanent, setPendingPermanent] = useState<PendingPermanent | null>(null);

  // Cotação manual: o agrônomo recebeu os preços por telefone/WhatsApp e
  // preenche ele mesmo — reusa a MESMA tela pública que a loja usaria, então a
  // cotação entra na comparação como qualquer outra.
  const [manualOpen, setManualOpen] = useState(false);
  const [manualStoreName, setManualStoreName] = useState("");
  const [manualSaving, setManualSaving] = useState(false);

  const startManualQuote = async () => {
    const name = manualStoreName.trim();
    if (!name) {
      toast.error("Dê um nome à loja (ex: Agro Norte).");
      return;
    }
    setManualSaving(true);
    try {
      // Sem link de cotação ainda? Cria na hora (mesmo request das lojas).
      const token = data?.request?.token ?? (await createQuoteRequest(listId)).token;
      const created = await createQuoteResponse(token, { store_name: name });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseListQuotes(listId),
      });
      setManualOpen(false);
      setManualStoreName("");
      window.open(
        `/cotacao/${token}/loja/${created.response_token}`,
        "_blank",
        "noopener,noreferrer",
      );
      toast.success(`Cotação de ${name} criada — preencha os preços na aba que abriu.`);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível criar a cotação manual."));
    } finally {
      setManualSaving(false);
    }
  };

  const manualQuoteButton = (
    <Button variant="outline" size="sm" onClick={() => setManualOpen(true)}>
      <PencilLine className="size-3.5" />
      Cotação manual
    </Button>
  );

  const manualQuoteDialog = (
    <Dialog open={manualOpen} onOpenChange={setManualOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilLine className="h-5 w-5 text-primary" />
            Preencher cotação manualmente
          </DialogTitle>
          <DialogDescription>
            Recebeu os preços por telefone ou WhatsApp? Dê um nome à loja e preencha
            você mesmo — a cotação entra na comparação igual às respondidas pelo link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="manual-store-name">Nome da loja</Label>
          <Input
            id="manual-store-name"
            value={manualStoreName}
            onChange={(e) => setManualStoreName(e.target.value)}
            placeholder="Ex: Agro Norte"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void startManualQuote();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setManualOpen(false)} disabled={manualSaving}>
            Cancelar
          </Button>
          <Button onClick={() => void startManualQuote()} disabled={manualSaving} className="gap-2">
            {manualSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Criar e preencher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const itemUnitById = useMemo(() => {
    const map = new Map<string, string>();
    data?.items.forEach((it) => map.set(it.purchase_list_item_id, it.dose_unit));
    return map;
  }, [data]);

  const trashCount = (trash?.responses.length ?? 0) + (trash?.items.length ?? 0);

  // --- Ações (soft delete / restaurar são reversíveis → sem diálogo) ---------

  const moveResponseToTrash = (r: QuoteComparisonResponse) =>
    actions.softDeleteResponse.mutate(r.id, {
      onSuccess: () => toast.success(`Cotação de ${r.store_name} movida para a lixeira.`),
      onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível excluir a cotação.")),
    });

  const moveItemToTrash = (responseId: string, itemId: string, productName: string) =>
    actions.softDeleteItem.mutate(
      { responseId, itemId },
      {
        onSuccess: () => toast.success(`Linha de ${productName} movida para a lixeira.`),
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível excluir a linha.")),
      },
    );

  const restoreResponse = (responseId: string) =>
    actions.restoreResponse.mutate(responseId, {
      onSuccess: () => toast.success("Cotação restaurada."),
      onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível restaurar.")),
    });

  const restoreItem = (responseId: string, itemId: string) =>
    actions.restoreItem.mutate(
      { responseId, itemId },
      {
        onSuccess: () => toast.success("Linha restaurada."),
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível restaurar.")),
      },
    );

  const confirmPermanent = async () => {
    if (!pendingPermanent) return;
    try {
      if (pendingPermanent.kind === "response") {
        await actions.deleteResponse.mutateAsync(pendingPermanent.responseId);
      } else {
        await actions.deleteItem.mutateAsync({
          responseId: pendingPermanent.responseId,
          itemId: pendingPermanent.itemId,
        });
      }
      toast.success("Excluído definitivamente.");
      setPendingPermanent(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível excluir definitivamente."));
    }
  };

  if (isLoading) return <TableRowsSkeleton rows={5} columns={4} />;

  if (!data || !data.request) {
    return (
      <>
        <EmptyState
          variant="inline"
          title="Gere o link de cotação para começar a receber preços das lojas."
          description="Recebeu preços por telefone ou WhatsApp? Você também pode preencher uma cotação manualmente."
          action={manualQuoteButton}
        />
        {manualQuoteDialog}
      </>
    );
  }

  const { items, responses } = data;

  const trashPanel =
    trashCount > 0 && showTrash ? (
      <div className="rounded-xl border border-border bg-rail/40 p-4 text-sm">
        <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          Lixeira
        </h4>
        <ul className="flex flex-col gap-2">
          {trash?.responses.map((r) => (
            <li
              key={`resp-${r.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              <span className="flex items-center gap-1.5 text-text-strong">
                <Store className="h-3.5 w-3.5 text-muted-foreground" />
                Cotação da loja <strong>{r.store_name}</strong>
              </span>
              <span className="flex shrink-0 gap-1.5">
                <Button variant="ghost" size="icon-xs" title="Restaurar" onClick={() => restoreResponse(r.id)}>
                  <RotateCcw className="size-3.5" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon-xs"
                  title="Excluir definitivamente"
                  onClick={() =>
                    setPendingPermanent({
                      kind: "response",
                      responseId: r.id,
                      label: `a cotação da loja ${r.store_name}`,
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </li>
          ))}
          {trash?.items.map((it) => (
            <li
              key={`item-${it.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              <span className="text-text-strong">
                {it.product_name ?? "Produto"}{" "}
                <span className="text-muted-foreground">· loja {it.store_name ?? "—"}</span>
              </span>
              <span className="flex shrink-0 gap-1.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Restaurar"
                  onClick={() => restoreItem(it.response_id, it.id)}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon-xs"
                  title="Excluir definitivamente"
                  onClick={() =>
                    setPendingPermanent({
                      kind: "item",
                      responseId: it.response_id,
                      itemId: it.id,
                      label: `a linha de ${it.product_name ?? "produto"} (loja ${it.store_name ?? "—"})`,
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const trashToggle =
    trashCount > 0 ? (
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setShowTrash((v) => !v)}>
          <Trash2 className="size-3.5" />
          Lixeira ({trashCount})
        </Button>
      </div>
    ) : null;

  const confirmDialog = (
    <ConfirmDialog
      open={pendingPermanent != null}
      onOpenChange={(open) => {
        if (!open) setPendingPermanent(null);
      }}
      title="Excluir definitivamente?"
      description={
        pendingPermanent
          ? `Você vai excluir definitivamente ${pendingPermanent.label}. Esta ação não pode ser desfeita.`
          : undefined
      }
      tone="destructive"
      confirmLabel="Excluir definitivamente"
      loading={actions.deleteResponse.isPending || actions.deleteItem.isPending}
      onConfirm={confirmPermanent}
    />
  );

  if (responses.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {trashToggle}
        {trashPanel}
        <EmptyState
          variant="inline"
          title="Nenhuma loja respondeu ainda."
          description="Assim que uma loja preencher a cotação pelo link, os preços aparecem aqui. Recebeu preços por telefone? Preencha uma cotação manual."
          action={manualQuoteButton}
        />
        {manualQuoteDialog}
        {confirmDialog}
      </div>
    );
  }

  // Menor preço efetivo por item + a(s) loja(s) que oferecem esse preço.
  const cheapestByItem = new Map<string, number>();
  const bestStoresByItem = new Map<string, string[]>();
  for (const it of items) {
    let min = Infinity;
    for (const r of responses) {
      const cell = r.items.find((ci) => ci.purchase_list_item_id === it.purchase_list_item_id);
      const eff = cell?.unit_price_brl ?? cell?.substitute_unit_price_brl ?? null;
      if (eff != null && eff < min) min = eff;
    }
    if (min !== Infinity) {
      cheapestByItem.set(it.purchase_list_item_id, min);
      const stores = responses
        .filter((r) => {
          const cell = r.items.find(
            (ci) => ci.purchase_list_item_id === it.purchase_list_item_id,
          );
          const eff = cell?.unit_price_brl ?? cell?.substitute_unit_price_brl ?? null;
          return eff != null && eff <= min;
        })
        .map((r) => r.store_name);
      bestStoresByItem.set(it.purchase_list_item_id, stores);
    }
  }

  const cheapestTotal = Math.min(
    ...responses.map((r) => (r.total_brl > 0 ? r.total_brl : Infinity)),
  );
  const bestTotalStores = responses
    .filter((r) => r.total_brl > 0 && r.total_brl <= cheapestTotal)
    .map((r) => r.store_name);

  // Reenvia o MESMO link privado de edição da loja (caso o lojista o perca).
  const requestToken = data.request.token;
  const shareStoreLink = async (r: QuoteComparisonResponse) => {
    const url = `${window.location.origin}/cotacao/${requestToken}/loja/${r.response_token}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: `Cotação — ${r.store_name}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success(`Link de ${r.store_name} copiado — é só enviar à loja.`);
    } catch {
      // Usuário cancelou o compartilhamento ou o clipboard falhou — silencioso.
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-1.5">
        {manualQuoteButton}
        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
          <FileDown className="size-3.5" />
          Exportar
        </Button>
        {trashCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setShowTrash((v) => !v)}>
            <Trash2 className="size-3.5" />
            Lixeira ({trashCount})
          </Button>
        ) : null}
      </div>
      {manualQuoteDialog}
      {trashPanel}
      {data ? (
        <QuoteExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          data={data}
          context={{ listName, producerName, agronomistName }}
        />
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-rail text-left align-bottom">
              <th className="sticky left-0 z-20 w-[200px] min-w-[200px] bg-rail px-4 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                Produto
              </th>
              <th className="sticky left-[200px] z-20 w-[160px] min-w-[160px] max-w-[160px] bg-rail px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-success-strong shadow-[inset_-1px_0_0_0_var(--color-border)]">
                Melhor preço
              </th>
              {responses.map((r) => (
                <th key={r.id} className="min-w-[150px] px-3 py-3 text-right">
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-text-strong">
                      <Store className="h-3.5 w-3.5 text-primary-strong" />
                      {r.store_name}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title={`Reenviar o link de cotação de ${r.store_name}`}
                        className="text-muted-foreground hover:text-primary-strong"
                        onClick={() => void shareStoreLink(r)}
                      >
                        <Share2 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title={`Mover cotação de ${r.store_name} para a lixeira`}
                        className="text-muted-foreground hover:text-danger-strong"
                        onClick={() => moveResponseToTrash(r)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </span>
                    {statusBadge(r)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const unit = itemUnitById.get(it.purchase_list_item_id) ?? it.dose_unit;
              const cheapest = cheapestByItem.get(it.purchase_list_item_id) ?? null;
              return (
                <tr key={it.purchase_list_item_id} className="border-b border-border last:border-b-0">
                  <td className="sticky left-0 z-10 w-[200px] min-w-[200px] max-w-[200px] bg-card px-4 py-2.5">
                    <div className="break-words font-semibold text-text-strong">{it.product_name}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {fmtQty(it.quantity_to_buy)} {unit} · {it.stage}
                    </div>
                  </td>
                  <td className="sticky left-[200px] z-10 w-[160px] min-w-[160px] max-w-[160px] bg-card px-3 py-2.5 align-top shadow-[inset_-1px_0_0_0_var(--color-border)]">
                    {cheapest != null ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold tabular-nums text-success-strong">
                          {fmtBrl(cheapest)}
                        </span>
                        <span className="inline-flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <Store className="h-3 w-3 text-primary-strong" />
                          {(bestStoresByItem.get(it.purchase_list_item_id) ?? []).join(", ")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-placeholder">—</span>
                    )}
                  </td>
                  {responses.map((r) => {
                    const cell = r.items.find(
                      (ci) => ci.purchase_list_item_id === it.purchase_list_item_id,
                    );
                    const eff = cell?.unit_price_brl ?? cell?.substitute_unit_price_brl ?? null;
                    const isCheapest = eff != null && cheapest != null && eff <= cheapest;
                    const hasData = cell != null && (eff != null || cell.availability != null);
                    return (
                      <td
                        key={r.id}
                        className={
                          "group relative px-3 py-2.5 text-right align-top " +
                          (isCheapest ? "bg-success-soft" : "")
                        }
                      >
                        {cell == null || (eff == null && cell.availability == null) ? (
                          <span className="text-placeholder">—</span>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            {cell.unit_price_brl != null ? (
                              <span
                                className={
                                  isCheapest
                                    ? "font-bold tabular-nums text-success-strong"
                                    : "font-semibold tabular-nums text-text-strong"
                                }
                              >
                                {fmtBrl(cell.unit_price_brl)}
                              </span>
                            ) : cell.availability === "UNAVAILABLE" ? (
                              <span className="text-xs text-muted-foreground">
                                {AVAILABILITY_LABEL.UNAVAILABLE}
                              </span>
                            ) : null}

                            {isCheapest && cell.unit_price_brl != null ? (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-success-strong">
                                ★ melhor
                              </span>
                            ) : null}

                            {cell.payment_term ? (
                              <span className="rounded bg-rail px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {PAYMENT_TERM_LABEL[cell.payment_term]}
                              </span>
                            ) : null}

                            {cell.substitute_product_name ? (
                              <span className="text-xs text-clay-strong">
                                ↪ {cell.substitute_product_name}
                                {cell.substitute_unit_price_brl != null
                                  ? ` · ${fmtBrl(cell.substitute_unit_price_brl)}`
                                  : ""}
                              </span>
                            ) : null}

                            {cell.availability && cell.availability !== "UNAVAILABLE" ? (
                              <span className="text-[10px] text-muted-foreground">
                                {AVAILABILITY_LABEL[cell.availability]}
                              </span>
                            ) : null}

                            {cell.notes ? (
                              <span className="max-w-[160px] text-[10px] text-muted-foreground/80">
                                {cell.notes}
                              </span>
                            ) : null}
                          </div>
                        )}
                        {hasData && cell ? (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title={`Excluir linha de ${it.product_name} (loja ${r.store_name})`}
                            className="absolute left-1 top-1 text-muted-foreground opacity-0 transition-opacity hover:text-danger-strong group-hover:opacity-100"
                            onClick={() => moveItemToTrash(r.id, cell.id, it.product_name)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-rail">
              <td className="sticky left-0 z-10 w-[200px] min-w-[200px] bg-rail px-4 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-text-strong">
                Total estimado
              </td>
              <td className="sticky left-[200px] z-10 w-[160px] min-w-[160px] max-w-[160px] bg-rail px-3 py-3 align-top shadow-[inset_-1px_0_0_0_var(--color-border)]">
                {Number.isFinite(cheapestTotal) && cheapestTotal > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold tabular-nums text-success-strong">
                      {fmtBrl(cheapestTotal)}
                    </span>
                    <span className="inline-flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <Store className="h-3 w-3 text-primary-strong" />
                      {bestTotalStores.join(", ")}
                    </span>
                  </div>
                ) : (
                  <span className="text-placeholder">—</span>
                )}
              </td>
              {responses.map((r) => {
                const isCheapest = r.total_brl > 0 && r.total_brl <= cheapestTotal;
                return (
                  <td
                    key={r.id}
                    className={
                      isCheapest
                        ? "px-3 py-3 text-right font-bold tabular-nums text-success-strong"
                        : "px-3 py-3 text-right font-semibold tabular-nums text-text-strong"
                    }
                  >
                    {r.total_brl > 0 ? fmtBrl(r.total_brl) : "—"}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      {confirmDialog}
    </div>
  );
}
