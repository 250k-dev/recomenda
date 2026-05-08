"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/domain/page-header";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { DataTable } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  useArchivedMixTemplates,
  useCreateMixTemplate,
  useDeleteMixTemplate,
  useHardDeleteMixTemplate,
  useMixTemplates,
} from "@/lib/api/hooks";

const CROP_LABELS: Record<string, string> = {
  SOYBEAN: "Soja",
  CORN: "Milho",
  ANY: "Qualquer",
};

const createSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  crop: z.enum(["SOYBEAN", "CORN", "ANY"]),
});

type CreateFormValues = z.infer<typeof createSchema>;

export default function MixTemplatesPage() {
  const { data: templates, isLoading } = useMixTemplates();
  const { data: archived, isLoading: isLoadingArchived } = useArchivedMixTemplates();
  const createMutation = useCreateMixTemplate();
  const deleteMutation = useDeleteMixTemplate();
  const hardDeleteMutation = useHardDeleteMixTemplate();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<"active" | "archived">("active");

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", crop: "SOYBEAN" },
  });

  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate(values, {
      onSuccess: (created) => {
        setSheetOpen(false);
        form.reset();
        router.push(`/mix-templates/${created.id}`);
      },
    });
  });

  const templatesData = templates ?? [];
  const archivedData = archived ?? [];

  const activeRows = templatesData.map((t: (typeof templatesData)[number]) => [
    <Link
      key={t.id}
      href={`/mix-templates/${t.id}`}
      className="font-medium text-[var(--brand)] underline"
    >
      {t.name}
    </Link>,
    CROP_LABELS[t.crop] ?? t.crop,
    <div key={`actions-${t.id}`} className="flex gap-2">
      <Button
        variant="outline"
        className="h-8 px-3 text-xs"
        onClick={() => router.push(`/mix-templates/${t.id}`)}
      >
        Editar
      </Button>
      <Button
        variant="outline"
        className="h-8 px-3 text-xs border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700"
        disabled={deleteMutation.isPending}
        onClick={() => deleteMutation.mutate(t.id)}
      >
        Remover
      </Button>
    </div>,
  ]);

  const archivedRows = archivedData.map((t: (typeof archivedData)[number]) => [
    t.name,
    CROP_LABELS[t.crop] ?? t.crop,
    <div key={`archived-actions-${t.id}`} className="flex gap-2">
      <Button
        variant="destructive"
        size="icon"
        className="h-8 w-8"
        disabled={hardDeleteMutation.isPending}
        title="Excluir permanentemente"
        onClick={() => {
          if (confirm(`Excluir permanentemente "${t.name}"? Esta ação não pode ser desfeita.`)) {
            hardDeleteMutation.mutate(t.id);
          }
        }}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>,
  ]);

  return (
    <>
      <PageHeader
        title="Receitas de Mistura"
        description="Composição de doses por produto para cada aplicação."
      />

      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1">
          <button
            onClick={() => setTab("active")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "active"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            Ativos
          </button>
          <button
            onClick={() => setTab("archived")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "archived"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            Removidos
            {archivedData.length > 0 && (
              <span className="ml-2 rounded-full bg-zinc-300 px-1.5 py-0.5 text-xs text-zinc-700">
                {archivedData.length}
              </span>
            )}
          </button>
        </div>

        {tab === "active" && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button>Nova receita</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-96">
              <SheetHeader>
                <SheetTitle>Criar nova receita de mistura</SheetTitle>
              </SheetHeader>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-900">Nome</label>
                  <Input
                    {...form.register("name")}
                    placeholder="Ex: Mix Fungicida Premium"
                    className="h-10"
                  />
                  {form.formState.errors.name && (
                    <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-900">Cultura</label>
                  <select
                    {...form.register("crop")}
                    className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  >
                    <option value="SOYBEAN">Soja</option>
                    <option value="CORN">Milho</option>
                    <option value="ANY">Qualquer</option>
                  </select>
                </div>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full"
                >
                  {createMutation.isPending ? "Criando..." : "Criar receita"}
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {tab === "active" ? (
        isLoading ? (
          <TableRowsSkeleton rows={8} columns={3} />
        ) : (
          <DataTable headers={["Nome", "Cultura", ""]} rows={activeRows} />
        )
      ) : isLoadingArchived ? (
        <TableRowsSkeleton rows={6} columns={3} />
      ) : archivedRows.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma receita removida.</p>
      ) : (
        <DataTable headers={["Nome", "Cultura", ""]} rows={archivedRows} />
      )}
    </>
  );
}
