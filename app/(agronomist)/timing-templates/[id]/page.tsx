"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Clock, Droplet, Pencil, Plus } from "lucide-react";

import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { PageHeader } from "@/components/domain/page-header";
import { TemplateEditorSkeleton } from "@/components/domain/page-skeletons";
import { SectionTitle } from "@/components/ui/section-title";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useTimingTemplate,
  useCreateTimingStage,
  useUpdateTimingStage,
  useDeleteTimingStage,
  useReorderTimingStages,
  useUpdateTimingTemplate,
  useMixTemplates,
} from "@/lib/api/hooks";
import type { TimingStage } from "@/lib/api/client";

const TRIGGER_LABELS: Record<string, string> = {
  DAYS_AFTER_PLANTING: "Dias após plantio",
  DAYS_AFTER_DESICCATION: "Dias após dessecação",
  DAYS_AFTER_TASSELING: "Dias após pendoamento",
  FIXED_DATE_OFFSET: "Offset de data fixa",
};

const stageSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  trigger_type: z.enum([
    "DAYS_AFTER_PLANTING",
    "DAYS_AFTER_DESICCATION",
    "DAYS_AFTER_TASSELING",
    "FIXED_DATE_OFFSET",
  ]),
  window_start_days: z.number().int(),
  window_end_days: z.number().int(),
  default_mix_template_id: z.string().nullable().optional(),
});

type StageFormValues = z.infer<typeof stageSchema>;

function StageRow({
  stage,
  templateId,
  index,
  total,
  mixTemplates,
  onMoveUp,
  onMoveDown,
}: {
  stage: TimingStage;
  templateId: string;
  index: number;
  total: number;
  mixTemplates: Array<{ id: string; name: string }>;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const updateStage = useUpdateTimingStage(templateId);
  const deleteStage = useDeleteTimingStage(templateId);

  const form = useForm<StageFormValues>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      name: stage.name,
      trigger_type: stage.trigger_type as StageFormValues["trigger_type"],
      window_start_days: stage.window_start_days,
      window_end_days: stage.window_end_days,
      default_mix_template_id: stage.default_mix_template_id ?? "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    updateStage.mutate(
      {
        id: stage.id,
        ...values,
        default_mix_template_id: values.default_mix_template_id || null,
      },
      { onSuccess: () => setEditing(false) },
    );
  });

  const mixName = mixTemplates.find((m) => m.id === stage.default_mix_template_id)?.name;

  if (editing) {
    return (
      <li className="rounded-xl border border-border bg-card p-4 shadow-xs animate-slide-up">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nome</Label>
            <Input {...form.register("name")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Gatilho</Label>
            <NativeSelect {...form.register("trigger_type")}>
              {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label>Início (dias)</Label>
            <Input type="number" {...form.register("window_start_days", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1.5">
            <Label>Fim (dias)</Label>
            <Input type="number" {...form.register("window_end_days", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1.5 sm:col-span-4">
            <Label>Receita padrão</Label>
            <NativeSelect {...form.register("default_mix_template_id")}>
              <option value="">Nenhuma</option>
              {mixTemplates.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 sm:justify-end">
            <Button type="submit" disabled={updateStage.isPending}>
              Salvar
            </Button>
            <Button variant="ghost" type="button" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-primary/30 hover:shadow-md">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="Mover para cima"
          className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label="Mover para baixo"
          className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{stage.name}</p>
        <p className="text-xs text-muted-foreground">
          {TRIGGER_LABELS[stage.trigger_type] ?? stage.trigger_type} · Janela {stage.window_start_days}–{stage.window_end_days} dias
        </p>
        {mixName && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
            <Droplet className="h-3 w-3" />
            {mixName}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
        >
          Remover
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remover estágio"
        description={`Remover o estágio "${stage.name}" da recomendação?`}
        confirmLabel="Remover"
        tone="destructive"
        loading={deleteStage.isPending}
        onConfirm={async () => {
          await new Promise<void>((resolve, reject) =>
            deleteStage.mutate(stage.id, {
              onSuccess: () => {
                setConfirmOpen(false);
                resolve();
              },
              onError: (err) => reject(err),
            }),
          );
        }}
      />
    </li>
  );
}

export default function TimingTemplateDetailPage() {
  const params = useParams<{ id: string }>();
  const templateId = params.id;

  const { data: template, isLoading } = useTimingTemplate(templateId);
  const { data: mixTemplatesData } = useMixTemplates();
  const createStage = useCreateTimingStage(templateId);
  const reorder = useReorderTimingStages(templateId);
  const updateTemplate = useUpdateTimingTemplate(templateId);

  const mixTemplates = mixTemplatesData ?? [];

  const [showStageForm, setShowStageForm] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const stageForm = useForm<StageFormValues>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      name: "",
      trigger_type: "DAYS_AFTER_PLANTING",
      window_start_days: 0,
      window_end_days: 7,
      default_mix_template_id: "",
    },
  });

  const onAddStage = stageForm.handleSubmit((values: StageFormValues) => {
    const stages = template?.stages ?? [];
    const nextOrderIndex =
      stages.length > 0 ? Math.max(...stages.map((s) => s.order_index)) + 1 : 1;

    createStage.mutate(
      {
        ...values,
        order_index: nextOrderIndex,
        default_mix_template_id: values.default_mix_template_id || null,
      },
      {
        onSuccess: () => {
          setShowStageForm(false);
          stageForm.reset();
          toast.success("Estágio criado.");
        },
        onError: (error: unknown) => {
          const msg = error instanceof Error ? error.message : "Falha ao criar estágio.";
          toast.error(msg);
        },
      },
    );
  });

  function moveStage(index: number, direction: "up" | "down") {
    const stages = [...(template?.stages ?? [])].sort((a, b) => a.order_index - b.order_index);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [stages[index], stages[targetIndex]] = [stages[targetIndex], stages[index]];
    reorder.mutate(stages.map((s) => s.id));
  }

  if (isLoading) return <TemplateEditorSkeleton />;
  if (!template)
    return (
      <EmptyState
        icon={Clock}
        title="Recomendação não encontrada"
        description="A recomendação pode ter sido removida ou você não tem acesso."
      />
    );

  const sortedStages = [...(template.stages ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <BreadcrumbBack
        items={[
          { label: "Recomendações", href: "/timing-templates" },
          { label: template.name },
        ]}
      />

      {editingName ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-10 max-w-md text-xl font-semibold"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            autoFocus
          />
          <Button
            onClick={() => {
              updateTemplate.mutate(
                { name: nameValue },
                { onSuccess: () => setEditingName(false) },
              );
            }}
            disabled={updateTemplate.isPending}
          >
            Salvar
          </Button>
          <Button variant="ghost" onClick={() => setEditingName(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <PageHeader
          title={template.name}
          description={`${template.crop === "SOYBEAN" ? "Soja" : "Milho"} · ${sortedStages.length} estágio${sortedStages.length === 1 ? "" : "s"}`}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNameValue(template.name);
                setEditingName(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Renomear
            </Button>
          }
        />
      )}

      <SectionTitle
        title="Estágios"
        description="Ordene cronologicamente. Cada estágio pode ter uma receita padrão."
        action={
          <Button
            variant={showStageForm ? "outline" : "default"}
            onClick={() => setShowStageForm((v) => !v)}
          >
            {showStageForm ? (
              "Cancelar"
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Adicionar estágio
              </>
            )}
          </Button>
        }
      />

      {showStageForm && (
        <Card className="animate-slide-up p-4">
          <form onSubmit={onAddStage} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="stage-name">Nome</Label>
              <Input id="stage-name" {...stageForm.register("name")} placeholder="Ex.: Primeiro fungicida" />
              {stageForm.formState.errors.name ? (
                <p className="text-xs text-destructive">{stageForm.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="stage-trigger">Gatilho</Label>
              <NativeSelect id="stage-trigger" {...stageForm.register("trigger_type")}>
                {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stage-start">Início (dias)</Label>
              <Input
                id="stage-start"
                type="number"
                {...stageForm.register("window_start_days", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stage-end">Fim (dias)</Label>
              <Input
                id="stage-end"
                type="number"
                {...stageForm.register("window_end_days", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-4">
              <Label htmlFor="stage-mix">Receita padrão</Label>
              <NativeSelect id="stage-mix" {...stageForm.register("default_mix_template_id")}>
                <option value="">Nenhuma</option>
                {mixTemplates.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex items-end justify-end sm:col-span-2">
              <Button type="submit" disabled={createStage.isPending}>
                {createStage.isPending ? "Adicionando…" : "Adicionar"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {sortedStages.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Nenhum estágio cadastrado"
          description="Adicione o primeiro estágio para montar a linha do tempo desta recomendação."
          action={
            !showStageForm ? (
              <Button onClick={() => setShowStageForm(true)}>
                <Plus className="h-4 w-4" />
                Adicionar estágio
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {sortedStages.map((stage, index) => (
            <StageRow
              key={stage.id}
              stage={stage}
              templateId={templateId}
              index={index}
              total={sortedStages.length}
              mixTemplates={mixTemplates}
              onMoveUp={() => moveStage(index, "up")}
              onMoveDown={() => moveStage(index, "down")}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
