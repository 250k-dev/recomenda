"use client";

import { useMemo, useState } from "react";
import {
  Boxes,
  Download,
  Eye,
  History,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { MoneyInput } from "@recomenda/ui/forms/money-input";
import { SearchableSelect } from "@recomenda/ui/forms/select";
import { PageHero } from "@/components/domain/page-hero";
import { StockExportDialog } from "@/components/domain/stock-export-dialog";
import { StockHistoryDialog } from "@/components/domain/stock-history-dialog";
import { StockOriginsDialog } from "@/components/domain/stock-origins-dialog";
import { useLocalCatalog } from "@recomenda/api-hooks";
import { useProducerStock, useAdjustProducerStock, useDeleteProducerStock } from "@recomenda/api-hooks/producers";
import { apiErrorMessage } from "@recomenda/api/api-error";
import type { StockExportData } from "@recomenda/domain/stock/stock-export";
import { PRODUCT_CATEGORY_LABELS } from "@recomenda/utils";

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const fmtBrl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

/**
 * Estoque do produtor: quantidade e preço são deste produtor apenas —
 * nunca alteram o catálogo global. Pré-preenchem a lista de compra.
 */
export function ProducerStockSection({
  producerId,
  producerName,
}: {
  producerId: string;
  producerName?: string | null;
}) {
  const { data: stock, isLoading } = useProducerStock(producerId);
  const { data: catalogData } = useLocalCatalog();
  const adjust = useAdjustProducerStock(producerId);
  const removeStock = useDeleteProducerStock(producerId);

  const [formOpen, setFormOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [originProduct, setOriginProduct] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    local_product_id: string;
    product_name: string;
    in_use: boolean;
    list_names: string[];
  } | null>(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [priceBrl, setPriceBrl] = useState("");

  const products = useMemo(() => catalogData?.data ?? [], [catalogData?.data]);
  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.name, keywords: p.name })),
    [products],
  );

  const enrichedRows = useMemo(() => {
    return (stock ?? []).map((item) => {
      const catalog = productById.get(item.local_product_id);
      const price =
        item.price_brl != null && Number.isFinite(Number(item.price_brl))
          ? Number(item.price_brl)
          : null;
      const qty = Number(item.quantity) || 0;
      const category = item.category ?? catalog?.category ?? "";
      return {
        id: item.id,
        local_product_id: item.local_product_id,
        product_name: item.product_name ?? catalog?.name ?? "Produto",
        category,
        categoryLabel:
          PRODUCT_CATEGORY_LABELS[category as keyof typeof PRODUCT_CATEGORY_LABELS] ??
          category ??
          "—",
        quantity: qty,
        dose_unit: item.dose_unit ?? catalog?.dose_unit ?? "",
        price_brl: price,
        value_brl: price != null ? price * qty : null,
        in_use: Boolean(item.in_use),
        list_names: item.list_names ?? [],
      };
    });
  }, [stock, productById]);

  const dashboard = useMemo(() => {
    const productCount = enrichedRows.length;
    const totalQty = enrichedRows.reduce((s, r) => s + r.quantity, 0);
    const totalValue = enrichedRows.reduce((s, r) => s + (r.value_brl ?? 0), 0);
    const withPrice = enrichedRows.filter((r) => r.price_brl != null).length;
    return { productCount, totalQty, totalValue, withPrice };
  }, [enrichedRows]);

  const resetForm = () => {
    setProductId("");
    setQuantity("");
    setPriceBrl("");
    setFormOpen(false);
  };

  const onProductChange = (id: string) => {
    setProductId(id);
    const existing = enrichedRows.find((r) => r.local_product_id === id);
    if (existing) {
      setQuantity(String(existing.quantity));
      setPriceBrl(existing.price_brl != null ? String(existing.price_brl) : "");
    } else {
      setQuantity("");
      setPriceBrl("");
    }
  };

  const save = async () => {
    if (!productId) return toast.error("Selecione o produto.");
    const n = Number(quantity.replace(",", "."));
    if (Number.isNaN(n) || n < 0) {
      return toast.error("Informe uma quantidade válida.");
    }

    const priceRaw = priceBrl.trim();
    let price: number | null = null;
    if (priceRaw !== "") {
      price = Number(priceRaw.replace(",", "."));
      if (!Number.isFinite(price) || price < 0) {
        return toast.error("Informe um preço válido.");
      }
    }

    try {
      await adjust.mutateAsync({
        local_product_id: productId,
        new_quantity: n,
        // Sempre envia o preço deste produtor (null limpa) — não mexe no catálogo.
        price_brl: price,
      });
      toast.success("Estoque atualizado.");
      resetForm();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível salvar o estoque."));
    }
  };

  const editEntry = (row: (typeof enrichedRows)[number]) => {
    setFormOpen(true);
    setProductId(row.local_product_id);
    setQuantity(String(row.quantity));
    setPriceBrl(row.price_brl != null ? String(row.price_brl) : "");
  };

  const exportData: StockExportData = useMemo(
    () => ({
      producerName: producerName ?? null,
      items: enrichedRows.map((r) => ({
        product_name: r.product_name,
        category: r.category,
        category_label: r.categoryLabel,
        quantity: r.quantity,
        dose_unit: r.dose_unit,
        price_brl: r.price_brl,
        value_brl: r.value_brl,
      })),
    }),
    [enrichedRows, producerName],
  );

  const saving = adjust.isPending;
  const title = producerName
    ? `Estoque · ${producerName}`
    : "Estoque do produtor";

  return (
    <>
      <PageHero
        icon={<Boxes className="size-6" />}
        eyebrow="Estoque do produtor"
        title={title}
        stats={[
          {
            label: "Produtos",
            value: isLoading ? "…" : dashboard.productCount,
          },
          {
            label: "Qtde total",
            value: isLoading ? "…" : fmtQty(dashboard.totalQty),
          },
          {
            label: "Valor estimado",
            value: isLoading ? "…" : fmtBrl(dashboard.totalValue),
            sub:
              !isLoading &&
              dashboard.productCount > 0 &&
              dashboard.withPrice < dashboard.productCount
                ? `${dashboard.withPrice}/${dashboard.productCount} com preço`
                : undefined,
          },
        ]}
      >
        <p className="mt-4 text-sm text-muted-foreground sm:mt-5">
          Quantidade e preço deste produtor. Não altera o catálogo global — na
          lista de compra esses valores pré-preenchem automaticamente.
        </p>
      </PageHero>

      <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Itens em estoque</h2>
            <p className="text-xs text-muted-foreground">
              Cadastro exclusivo deste produtor. Preço e quantidade vão para a lista de compra.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4" />
              Histórico
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setExportOpen(true)}
              disabled={enrichedRows.length === 0}
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            {!formOpen ? (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => setFormOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar ao estoque
              </Button>
            ) : null}
          </div>
        </div>

        {formOpen ? (
          <div className="mb-5 rounded-xl border border-border bg-surface-2/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {productId && enrichedRows.some((r) => r.local_product_id === productId)
                  ? "Editar item"
                  : "Novo item"}
              </p>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground"
                aria-label="Fechar formulário"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label>Produto</Label>
                <SearchableSelect
                  value={productId}
                  onValueChange={onProductChange}
                  options={productOptions}
                  placeholder="Selecione o produto…"
                  filterLabel="Buscar produto"
                  searchPlaceholder="Buscar produto…"
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5 sm:w-36">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5 sm:w-40">
                <Label>Preço médio R$/un.</Label>
                <MoneyInput
                  placeholder="R$"
                  value={priceBrl}
                  onValueChange={setPriceBrl}
                />
              </div>
              <Button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando estoque…</p>
        ) : enrichedRows.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum produto em estoque cadastrado.
            </p>
            {!formOpen ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5"
                onClick={() => setFormOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar primeiro item
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Produto</th>
                  <th className="px-3 py-2 text-left">Categoria</th>
                  <th className="px-3 py-2 text-right">Quantidade</th>
                  <th className="px-3 py-2 text-right">Preço médio</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-center">Origem</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {enrichedRows.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-medium text-foreground">
                      <div className="flex flex-col items-start gap-1">
                        <span>{item.product_name}</span>
                        {item.in_use ? (
                          <Badge
                            variant="warning"
                            title={
                              item.list_names.length
                                ? `Em uso em: ${item.list_names.join(", ")}`
                                : undefined
                            }
                          >
                            Em uso
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.categoryLabel}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {fmtQty(item.quantity)}
                      {item.dose_unit ? ` ${item.dose_unit}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {item.price_brl != null ? fmtBrl(item.price_brl) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">
                      {item.value_brl != null ? fmtBrl(item.value_brl) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setOriginProduct({
                            id: item.local_product_id,
                            name: item.product_name,
                          })
                        }
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Ver origem"
                        title="Ver origem"
                      >
                        <Eye className="mx-auto h-4 w-4" />
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => editEntry(item)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Editar item"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              local_product_id: item.local_product_id,
                              product_name: item.product_name,
                              in_use: item.in_use,
                              list_names: item.list_names,
                            })
                          }
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Excluir item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <StockExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        data={exportData}
      />
      <StockHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        producerId={producerId}
      />
      <StockOriginsDialog
        open={originProduct != null}
        onOpenChange={(v) => {
          if (!v) setOriginProduct(null);
        }}
        producerId={producerId}
        localProductId={originProduct?.id ?? ""}
        productName={originProduct?.name ?? ""}
      />
      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={
          pendingDelete
            ? `Excluir ${pendingDelete.product_name} do estoque?`
            : "Excluir produto do estoque?"
        }
        description={
          pendingDelete?.in_use ? (
            <>
              Este produto está vinculado a{" "}
              {pendingDelete.list_names.length
                ? pendingDelete.list_names.join(", ")
                : "uma safra ativa"}
              . A necessidade de compra dessas safras será recalculada.
            </>
          ) : (
            "O produto sai do estoque deste produtor. Esta ação não pode ser desfeita."
          )
        }
        confirmLabel="Excluir"
        tone="destructive"
        loading={removeStock.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await removeStock.mutateAsync(pendingDelete.local_product_id);
            toast.success("Produto excluído do estoque.");
            setPendingDelete(null);
          } catch (e) {
            toast.error(apiErrorMessage(e, "Não foi possível excluir o estoque."));
          }
        }}
      />
    </>
  );
}
