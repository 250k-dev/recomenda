"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Clock,
  Leaf,
  Plus,
} from "lucide-react";

import { deactivateOutlineButtonClass } from "@/lib/action-button-styles";
import { cn } from "@/lib/utils";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { DeletePermanentIconButton } from "@/components/domain/delete-permanent-icon-button";
import { ListCardsSkeleton } from "@/components/domain/page-skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useArchivedTimingTemplates,
  useCreateTimingTemplate,
  useDeleteTimingTemplate,
  useHardDeleteTimingTemplate,
  useTimingTemplates,
} from "@/lib/api/hooks";
import { usePlanQuota } from "@/lib/api/hooks/auth";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api-error";
import { CROP_LABELS } from "@/lib/season-constants";

const createSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  crop: z.enum(["SOYBEAN", "CORN"]),
});

type CreateFormValues = z.infer<typeof createSchema>;

type ProducerTimingTemplatesPanelProps = {
  producerId: string;
  producerName: string;
  /** Quando definido, indica fluxo de onboarding: após criar, segue para a safra. */
  onboardingFarmId?: string;
};

export function ProducerTimingTemplatesPanel({
  producerId,
  producerName,
  onboardingFarmId,
}: ProducerTimingTemplatesPanelProps) {
  const router = useRouter();
  const { data: templates, isLoading } = useTimingTemplates(producerId);
  const { data: archived, isLoading: isLoadingArchived } =
    useArchivedTimingTemplates(producerId);
  const createMutation = useCreateTimingTemplate(producerId);
  const deleteMutation = useDeleteTimingTemplate(producerId);
  const hardDeleteMutation = useHardDeleteTimingTemplate(producerId);
  const { data: planQuota } = usePlanQuota();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(
    null,
  );
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
        const qs = onboardingFarmId
          ? `?onboarding=season&farm_id=${encodeURIComponent(onboardingFarmId)}`
          : "";
        router.push(
          `/producers/${producerId}/timing-templates/${created.id}${qs}`,
        );
      },
      onError: (err) => {
        setSheetOpen(false);
        if (apiErrorMessage(err, "").includes("modelos do plano")) setLimitOpen(true);
        else toast.error(apiErrorMessage(err, "Não foi possível criar o modelo."));
      },
    });
  });

  const templatesData = templates ?? [];
  const modelQuota = planQuota?.plan?.timing_template_quota ?? 3;
  const atModelLimit = templatesData.length >= modelQuota;
  const handleNewModel = () => {
    if (atModelLimit) setLimitOpen(true);
    else setSheetOpen(true);
  };
  const archivedData = archived ?? [];
  const baseHref = `/producers/${producerId}/timing-templates`;

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Modelos reutilizáveis de {producerName} — dessecação, fungicidas e janelas
      </p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedTabs
              value={tab}
              onValueChange={setTab}
              items={[
                { value: "active", label: "Ativos", badgeCount: templatesData.length },
                {
                  value: "archived",
                  label: "Removidos",
                  badgeCount: archivedData.length,
                },
              ]}
            />
            {tab === "active" ? (
              <Button size="sm" className="gap-1.5" onClick={handleNewModel}>
                <Plus className="h-4 w-4" />
                Novo modelo
              </Button>
            ) : null}
          </div>

          {tab === "active" ? (
            isLoading ? (
              <ListCardsSkeleton count={3} />
            ) : templatesData.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Nenhum modelo para este produtor"
                description="Crie modelos de recomendação para reutilizar nas safras deste produtor."
                variant="inline"
                action={
                  <Button size="sm" className="gap-1.5" onClick={handleNewModel}>
                    <Plus className="h-4 w-4" />
                    Criar primeiro modelo
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2">
                {templatesData.map((template) => (
                  <Link
                    key={template.id}
                    href={`${baseHref}/${template.id}`}
                    className="group flex flex-wrap items-center gap-3 rounded-xl border bg-background p-4 transition-all hover:border-primary/30 hover:shadow-sm"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Leaf className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{template.name}</p>
                      <Badge variant="outline" className="mt-1.5">
                        {CROP_LABELS[template.crop] ?? template.crop}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn("h-8", deactivateOutlineButtonClass)}
                        onClick={(e) => {
                          e.preventDefault();
                          setDeleteConfirm({ id: template.id, name: template.name });
                        }}
                      >
                        Remover
                      </Button>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary opacity-80 transition-opacity group-hover:opacity-100">
                        Editar
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : isLoadingArchived ? (
            <ListCardsSkeleton count={2} />
          ) : archivedData.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Nenhum modelo removido"
              variant="inline"
            />
          ) : (
            <div className="space-y-2">
              {archivedData.map((template) => (
                <div
                  key={template.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed bg-muted/20 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-muted-foreground">{template.name}</p>
                    <Badge variant="outline" className="mt-1.5">
                      {CROP_LABELS[template.crop] ?? template.crop}
                    </Badge>
                  </div>
                  <DeletePermanentIconButton
                    disabled={hardDeleteMutation.isPending}
                    onClick={() =>
                      setHardDeleteConfirm({ id: template.id, name: template.name })
                    }
                  />
                </div>
              ))}
            </div>
          )}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-4 py-4 pr-12">
            <SheetTitle>Novo modelo de recomendação</SheetTitle>
            <SheetDescription>
              O modelo ficará disponível apenas para este produtor nas próximas safras.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={onSubmit} className="space-y-4 px-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="timing-create-name">Nome</Label>
              <Input
                id="timing-create-name"
                {...form.register("name")}
                placeholder="Ex.: Soja padrão"
                autoFocus
              />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timing-create-crop">Cultura</Label>
              <Select
                id="timing-create-crop"
                className="w-full"
                {...form.register("crop")}
                value={form.watch("crop") ?? ""}
                filterLabel="Cultura"
                options={[
                  { value: "SOYBEAN", label: "Soja" },
                  { value: "CORN", label: "Milho" },
                ]}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1"
              >
                {createMutation.isPending ? "Criando…" : "Criar e configurar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={limitOpen}
        onOpenChange={setLimitOpen}
        title="Limite de modelos do plano atingido"
        description={`O seu plano permite no máximo ${modelQuota} ${
          modelQuota === 1 ? "modelo" : "modelos"
        } de recomendação. Para criar mais, contate o administrador para um plano com quota maior — ou exclua um modelo existente.`}
        confirmLabel="Entendi"
        onConfirm={async () => setLimitOpen(false)}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Remover modelo"
        description={
          deleteConfirm
            ? `O modelo "${deleteConfirm.name}" será movido para Removidos.`
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

/** @deprecated Use ProducerTimingTemplatesPanel inside a modal. */
export function ProducerTimingTemplatesSection(props: ProducerTimingTemplatesPanelProps) {
  return <ProducerTimingTemplatesPanel {...props} />;
}
