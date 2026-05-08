"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/page-header";
import { TemplateEditorSkeleton } from "@/components/domain/page-skeletons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useLocalCatalog,
  useMixTemplate,
  useCreateMixTemplateItem,
  useUpdateMixTemplateItem,
  useDeleteMixTemplateItem,
  useUpdateMixTemplate,
} from "@/lib/api/hooks";
import type { MixTemplateItem } from "@/lib/api/client";

const PREVIEW_AREA_HA = 100;

const itemSchema = z.object({
  local_product_id: z.string().min(1, "Produto obrigatório"),
  dose_per_hectare: z.number().positive("Dose deve ser maior que zero"),
});

type ItemFormValues = z.infer<typeof itemSchema>;

function ItemRow({
  item,
  templateId,
}: {
  item: MixTemplateItem;
  templateId: string;
}) {
  const [editing, setEditing] = useState(false);
  const updateItem = useUpdateMixTemplateItem(templateId);
  const deleteItem = useDeleteMixTemplateItem(templateId);

  const form = useForm<Pick<ItemFormValues, "dose_per_hectare">>({
    defaultValues: { dose_per_hectare: item.dose_per_hectare },
  });

  const onSubmit = form.handleSubmit(({ dose_per_hectare }) => {
    updateItem.mutate(
      { id: item.id, dose_per_hectare },
      { onSuccess: () => setEditing(false) },
    );
  });

  return (
    <tr className="border-t border-zinc-100">
      <td className="px-4 py-3 text-zinc-800">
        {item.product_name ?? item.local_product_id}
      </td>
      <td className="px-4 py-3 text-zinc-600">
        {editing ? (
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              className="w-28"
              {...form.register("dose_per_hectare")}
            />
            <span className="text-xs text-zinc-500">{item.dose_unit ?? "un"}/ha</span>
            <Button type="submit" className="h-7 px-2 text-xs" disabled={updateItem.isPending}>
              OK
            </Button>
            <Button variant="secondary" className="h-7 px-2 text-xs" onClick={() => setEditing(false)}>
              ✕
            </Button>
          </form>
        ) : (
          <span>
            {item.dose_per_hectare} {item.dose_unit ?? "un"}/ha
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-zinc-500">
        {(item.dose_per_hectare * PREVIEW_AREA_HA).toFixed(2)} {item.dose_unit ?? "un"}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {!editing && (
            <Button variant="secondary" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>
              Editar
            </Button>
          )}
          <Button
            variant="destructive"
            className="h-7 px-2 text-xs"
            disabled={deleteItem.isPending}
            onClick={() => deleteItem.mutate(item.id)}
          >
            Remover
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function MixTemplateDetailPage() {
  const params = useParams<{ id: string }>();
  const templateId = params.id;

  const { data: template, isLoading } = useMixTemplate(templateId);
  const { data: catalogData } = useLocalCatalog();
  const createItem = useCreateMixTemplateItem(templateId);
  const updateTemplate = useUpdateMixTemplate(templateId);

  const [showItemForm, setShowItemForm] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: { local_product_id: "", dose_per_hectare: 1 },
  });

  const onAddItem = form.handleSubmit((values: ItemFormValues) => {
    createItem.mutate(values, {
      onSuccess: () => {
        setShowItemForm(false);
        form.reset();
        toast.success("Produto adicionado com sucesso!");
      },
      onError: (error: any) => {
        console.error("Erro ao adicionar produto:", error);
        toast.error(`Erro: ${error?.message || "Falha ao adicionar produto"}`);
      },
    });
  });

  if (isLoading) return <TemplateEditorSkeleton />;
  if (!template) return <p className="text-sm text-red-600">Receita não encontrada.</p>;

  const items = template.items ?? [];
  const catalog = catalogData?.data ?? [];

  const CROP_LABELS: Record<string, string> = {
    SOYBEAN: "Soja",
    CORN: "Milho",
    ANY: "Qualquer",
  };

  return (
    <>
      <Link href="/mix-templates" className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        ← Voltar
      </Link>

      <div className="mb-6 flex items-start gap-3">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-xl font-semibold outline-none focus:ring-2 focus:ring-[var(--brand)]"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              autoFocus
            />
            <Button
              onClick={() =>
                updateTemplate.mutate({ name: nameValue }, { onSuccess: () => setEditingName(false) })
              }
              disabled={updateTemplate.isPending}
            >
              Salvar
            </Button>
            <Button variant="secondary" onClick={() => setEditingName(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <PageHeader
            title={template.name}
            description={`Cultura: ${CROP_LABELS[template.crop] ?? template.crop} · ${items.length} produto(s) · Preview para ${PREVIEW_AREA_HA} ha`}
          />
        )}
        {!editingName && (
          <Button
            variant="secondary"
            className="mt-1 h-8 px-3 text-xs"
            onClick={() => {
              setNameValue(template.name);
              setEditingName(true);
            }}
          >
            Renomear
          </Button>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-800">Produtos</h2>
        <Button onClick={() => setShowItemForm((v) => !v)}>
          {showItemForm ? "Cancelar" : "Adicionar produto"}
        </Button>
      </div>

      {showItemForm && (
        <Card className="mb-4">
          <form onSubmit={onAddItem} className="flex flex-wrap items-end gap-4">
            <div className="min-w-48 flex-1">
              <label className="mb-1 block text-xs text-zinc-600">Produto</label>
              <select
                {...form.register("local_product_id")}
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]"
              >
                <option value="">Selecione...</option>
                {catalog.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.local_product_id?.message}
              </p>
            </div>
            <div className="w-36">
              <label className="mb-1 block text-xs text-zinc-600">Dose por ha</label>
              <Input type="number" step="0.01" {...form.register("dose_per_hectare", { valueAsNumber: true })} />
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.dose_per_hectare?.message}
              </p>
            </div>
            <Button type="submit" disabled={createItem.isPending}>
              {createItem.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </form>
        </Card>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum produto cadastrado. Adicione o primeiro acima.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Produto</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Dose/ha</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">
                  Total ({PREVIEW_AREA_HA} ha)
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ItemRow key={item.id} item={item} templateId={templateId} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
