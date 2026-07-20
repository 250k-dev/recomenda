"use client";

import { useMemo, useState } from "react";
import { Boxes, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { SearchableSelect } from "@recomenda/ui/forms/select";
import { PageHero } from "@/components/domain/page-hero";
import { useLocalCatalog } from "@recomenda/api-hooks";
import { useProducerStock, useAdjustProducerStock } from "@recomenda/api-hooks/producers";
import { apiErrorMessage } from "@recomenda/api/api-error";

/**
 * Item 13 — Estoque do produtor: o agrônomo cadastra o que o produtor tem em
 * estoque. Esses valores pré-preenchem a coluna Estoque na lista de compra.
 */
export function ProducerStockSection({ producerId }: { producerId: string }) {
  const { data: stock, isLoading } = useProducerStock(producerId);
  const { data: catalogData } = useLocalCatalog();
  const adjust = useAdjustProducerStock(producerId);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  const products = useMemo(() => catalogData?.data ?? [], [catalogData?.data]);
  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.name, keywords: p.name })),
    [products],
  );

  const save = () => {
    if (!productId) return toast.error("Selecione o produto.");
    const n = Number(quantity);
    if (Number.isNaN(n) || n < 0) return toast.error("Informe uma quantidade válida.");
    adjust.mutate(
      { local_product_id: productId, new_quantity: n },
      {
        onSuccess: () => {
          toast.success("Estoque atualizado.");
          setProductId("");
          setQuantity("");
        },
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível salvar o estoque.")),
      },
    );
  };

  const editEntry = (localProductId: string, qty: number) => {
    setProductId(localProductId);
    setQuantity(String(qty));
  };

  return (
    <>
      <PageHero
        icon={<Boxes className="size-6" />}
        eyebrow="Estoque"
        title="Estoque do produtor"
        stats={[
          {
            label: "Produtos em estoque",
            value: isLoading ? "…" : (stock ?? []).length,
          },
        ]}
      />

    <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label>Produto</Label>
          <SearchableSelect
            value={productId}
            onValueChange={setProductId}
            options={productOptions}
            placeholder="Selecione o produto…"
            filterLabel="Buscar produto"
            searchPlaceholder="Buscar produto…"
            className="w-full"
          />
        </div>
        <div className="space-y-1.5 sm:w-40">
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
        <Button type="button" onClick={save} disabled={adjust.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          Salvar estoque
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando estoque…</p>
      ) : (stock ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
          Nenhum produto em estoque cadastrado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Produto</th>
                <th className="px-3 py-2 text-right">Quantidade</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {(stock ?? []).map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-foreground">{item.product_name ?? "Produto"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">
                    {item.quantity}
                    {item.dose_unit ? ` ${item.dose_unit}` : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => editEntry(item.local_product_id, item.quantity)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Editar quantidade"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
    </>
  );
}
