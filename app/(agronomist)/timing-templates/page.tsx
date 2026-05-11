"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { deactivateOutlineButtonClass } from "@/lib/action-button-styles";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/domain/page-header";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { DeletePermanentIconButton } from "@/components/domain/delete-permanent-icon-button";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { DataTable } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  useArchivedTimingTemplates,
  useCreateTimingTemplate,
  useDeleteTimingTemplate,
  useHardDeleteTimingTemplate,
  useTimingTemplates,
} from "@/lib/api/hooks";

const CROP_LABELS: Record<string, string> = {
  SOYBEAN: "Soja",
  CORN: "Milho",
};

const createSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  crop: z.enum(["SOYBEAN", "CORN"]),
});

type CreateFormValues = z.infer<typeof createSchema>;

export default function TimingTemplatesPage() {
  const { data: templates, isLoading } = useTimingTemplates();
  const { data: archived, isLoading: isLoadingArchived } = useArchivedTimingTemplates();
  const createMutation = useCreateTimingTemplate();
  const deleteMutation = useDeleteTimingTemplate();
  const hardDeleteMutation = useHardDeleteTimingTemplate();
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
        router.push(`/timing-templates/${created.id}`);
      },
    });
  });

  const templatesData = templates ?? [];
  const archivedData = archived ?? [];

  const activeRows = templatesData.map((t: (typeof templatesData)[number]) => [
    <Link
      key={t.id}
      href={`/timing-templates/${t.id}`}
      className="font-medium text-[var(--brand)] underline"
    >
      {t.name}
    </Link>,
    CROP_LABELS[t.crop] ?? t.crop,
    <div key={`actions-${t.id}`} className="flex gap-2">
      <Button
        variant="outline"
        className="h-8 px-3 text-xs"
        onClick={() => router.push(`/timing-templates/${t.id}`)}
      >
        Editar
      </Button>
      <Button
        variant="outline"
        className={cn("h-8 px-3 text-xs", deactivateOutlineButtonClass)}
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
      <DeletePermanentIconButton
        disabled={hardDeleteMutation.isPending}
        onClick={() => {
          if (confirm(`Excluir permanentemente "${t.name}"? Esta ação não pode ser desfeita.`)) {
            hardDeleteMutation.mutate(t.id);
          }
        }}
      />
    </div>,
  ]);

  return (
    <>
      <PageHeader
        title="Recomendação"
        description="Definição de estágios e janelas de aplicação por cultura."
      />

      <div className="mb-4 flex items-center justify-between">
        <SegmentedTabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "active", label: "Ativos" },
            { value: "archived", label: "Removidos", badgeCount: archivedData.length },
          ]}
        />

        {tab === "active" && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button>Nova recomendação</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-96">
              <SheetHeader>
                <SheetTitle>Criar nova recomendação</SheetTitle>
              </SheetHeader>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-900">Nome</label>
                  <Input
                    {...form.register("name")}
                    placeholder="Ex: Soja Padrão"
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
                  </select>
                </div>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full"
                >
                  {createMutation.isPending ? "Criando..." : "Criar recomendação"}
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
        <p className="text-sm text-zinc-500">Nenhuma recomendação removida.</p>
      ) : (
        <DataTable headers={["Nome", "Cultura", ""]} rows={archivedRows} />
      )}
    </>
  );
}
