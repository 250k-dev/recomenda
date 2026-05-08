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
      <li className="rounded-lg border border-zinc-200 bg-white p-4">
        <form onSubmit={onSubmit} className="flex flex-wrap gap-3">
          <div className="min-w-40 flex-1">
            <label className="mb-1 block text-xs text-zinc-600">Nome</label>
            <Input {...form.register("name")} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-600">Gatilho</label>
            <select
              {...form.register("trigger_type")}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-(--brand)"
            >
              {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs text-zinc-600">Início (dias)</label>
            <Input type="number" {...form.register("window_start_days", { valueAsNumber: true })} />
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs text-zinc-600">Fim (dias)</label>
            <Input type="number" {...form.register("window_end_days", { valueAsNumber: true })} />
          </div>
          <div className="min-w-48 flex-1">
            <label className="mb-1 block text-xs text-zinc-600">Receita de mistura padrão</label>
            <select
              {...form.register("default_mix_template_id")}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-(--brand)"
            >
              <option value="">Nenhuma</option>
              {mixTemplates.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={updateStage.isPending}>
              Salvar
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
        >
          ▲
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
        >
          ▼
        </button>
      </div>
      <div className="flex-1">
        <p className="font-medium text-zinc-900">{stage.name}</p>
        <p className="text-xs text-zinc-500">
          {TRIGGER_LABELS[stage.trigger_type] ?? stage.trigger_type} · Janela:{" "}
          {stage.window_start_days}–{stage.window_end_days} dias
        </p>
        {mixName && (
          <p className="mt-0.5 text-xs text-emerald-600">🧪 {mixName}</p>
        )}
      </div>
      <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => setEditing(true)}>
        Editar
      </Button>
      <Button
        variant="destructive"
        className="h-8 px-3 text-xs"
        disabled={deleteStage.isPending}
        onClick={() => deleteStage.mutate(stage.id)}
      >
        Remover
      </Button>
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
    const nextOrderIndex = stages.length > 0
      ? Math.max(...stages.map((s) => s.order_index)) + 1
      : 1;

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
          toast.success("Estágio criado com sucesso!");
        },
        onError: (error: any) => {
          console.error("Erro ao criar estágio:", error);
          toast.error(`Erro: ${error?.message || "Falha ao criar estágio"}`);
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
  if (!template) return <p className="text-sm text-red-600">Calendário não encontrado.</p>;

  const sortedStages = [...(template.stages ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );

  return (
    <>
      <Link href="/timing-templates" className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        ← Voltar
      </Link>

      <div className="mb-6 flex items-start gap-3">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-xl font-semibold outline-none focus:ring-2 focus:ring-(--brand)"
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
            <Button variant="secondary" onClick={() => setEditingName(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <PageHeader
            title={template.name}
            description={`Cultura: ${template.crop === "SOYBEAN" ? "Soja" : "Milho"} · ${sortedStages.length} estágio(s)`}
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
        <h2 className="text-base font-semibold text-zinc-800">Estágios</h2>
        <Button onClick={() => setShowStageForm((v) => !v)}>
          {showStageForm ? "Cancelar" : "Adicionar estágio"}
        </Button>
      </div>

      {showStageForm && (
        <Card className="mb-4">
          <form onSubmit={onAddStage} className="flex flex-wrap gap-3">
            <div className="min-w-40 flex-1">
              <label className="mb-1 block text-xs text-zinc-600">Nome</label>
              <Input {...stageForm.register("name")} placeholder="Ex: Primeiro Fungicida" />
              <p className="mt-1 text-xs text-red-600">{stageForm.formState.errors.name?.message}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-600">Gatilho</label>
              <select
                {...stageForm.register("trigger_type")}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-(--brand)"
              >
                {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs text-zinc-600">Início (dias)</label>
              <Input type="number" {...stageForm.register("window_start_days", { valueAsNumber: true })} />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs text-zinc-600">Fim (dias)</label>
              <Input type="number" {...stageForm.register("window_end_days", { valueAsNumber: true })} />
            </div>
            <div className="min-w-48 flex-1">
              <label className="mb-1 block text-xs text-zinc-600">Receita de mistura padrão</label>
              <select
                {...stageForm.register("default_mix_template_id")}
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-(--brand)"
              >
                <option value="">Nenhuma</option>
                {mixTemplates.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createStage.isPending}>
                {createStage.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {sortedStages.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum estágio cadastrado. Adicione o primeiro acima.</p>
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
    </>
  );
}
