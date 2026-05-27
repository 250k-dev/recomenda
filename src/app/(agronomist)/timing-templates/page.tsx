"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Clock, Plus } from "lucide-react";

import { deactivateOutlineButtonClass } from "@/lib/action-button-styles";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/domain/page-header";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { DeletePermanentIconButton } from "@/components/domain/delete-permanent-icon-button";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<{ id: string; name: string } | null>(
    null,
  );

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
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {t.name}
    </Link>,
    CROP_LABELS[t.crop] ?? t.crop,
    <div key={`actions-${t.id}`} className="flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => router.push(`/timing-templates/${t.id}`)}>
        Editar
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={cn(deactivateOutlineButtonClass)}
        onClick={() => setDeleteConfirm({ id: t.id, name: t.name })}
      >
        Remover
      </Button>
    </div>,
  ]);

  const archivedRows = archivedData.map((t: (typeof archivedData)[number]) => [
    t.name,
    CROP_LABELS[t.crop] ?? t.crop,
    <div key={`archived-actions-${t.id}`} className="flex justify-end gap-2">
      <DeletePermanentIconButton
        disabled={hardDeleteMutation.isPending}
        onClick={() => setHardDeleteConfirm({ id: t.id, name: t.name })}
      />
    </div>,
  ]);

  return (
    <>
      <PageHeader
        icon={<Clock className="h-5 w-5" />}
        section="Configurações"
        title="Recomendações"
        description="Definição de estágios e janelas de aplicação por cultura."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
              <Button>
                <Plus className="h-4 w-4" />
                Nova recomendação
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-96">
              <SheetHeader>
                <SheetTitle>Nova recomendação</SheetTitle>
              </SheetHeader>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="timing-create-name">Nome</Label>
                  <Input
                    id="timing-create-name"
                    {...form.register("name")}
                    placeholder="Ex.: Soja padrão"
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="timing-create-crop">Cultura</Label>
                  <NativeSelect id="timing-create-crop" {...form.register("crop")}>
                    <option value="SOYBEAN">Soja</option>
                    <option value="CORN">Milho</option>
                  </NativeSelect>
                </div>
                <Button type="submit" disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? "Criando…" : "Criar recomendação"}
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {tab === "active" ? (
        isLoading ? (
          <TableRowsSkeleton rows={8} columns={3} />
        ) : activeRows.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Nenhuma recomendação criada"
            description="Crie recomendações para padronizar o calendário de aplicações por cultura."
            action={
              <Button onClick={() => setSheetOpen(true)}>
                <Plus className="h-4 w-4" />
                Nova recomendação
              </Button>
            }
          />
        ) : (
          <DataTable headers={["Nome", "Cultura", ""]} rows={activeRows} />
        )
      ) : isLoadingArchived ? (
        <TableRowsSkeleton rows={6} columns={3} />
      ) : archivedRows.length === 0 ? (
        <EmptyState icon={Clock} title="Nenhuma recomendação removida" variant="inline" />
      ) : (
        <DataTable headers={["Nome", "Cultura", ""]} rows={archivedRows} />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Remover recomendação"
        description={
          deleteConfirm
            ? `A recomendação "${deleteConfirm.name}" será movida para Removidos.`
            : undefined
        }
        confirmLabel="Remover"
        tone="destructive"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleteConfirm) return;
          await new Promise<void>((resolve, reject) =>
            deleteMutation.mutate(deleteConfirm.id, {
              onSuccess: () => {
                setDeleteConfirm(null);
                resolve();
              },
              onError: (err) => reject(err),
            }),
          );
        }}
      />

      <ConfirmDialog
        open={!!hardDeleteConfirm}
        onOpenChange={(open) => !open && setHardDeleteConfirm(null)}
        title="Excluir permanentemente"
        description={
          hardDeleteConfirm
            ? `Excluir "${hardDeleteConfirm.name}" permanentemente? Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        tone="destructive"
        loading={hardDeleteMutation.isPending}
        onConfirm={async () => {
          if (!hardDeleteConfirm) return;
          await new Promise<void>((resolve, reject) =>
            hardDeleteMutation.mutate(hardDeleteConfirm.id, {
              onSuccess: () => {
                setHardDeleteConfirm(null);
                resolve();
              },
              onError: (err) => reject(err),
            }),
          );
        }}
      />
    </>
  );
}
