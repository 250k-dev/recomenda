"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Clock, Pencil } from "lucide-react";

import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { TemplateEditorSkeleton } from "@/components/domain/page-skeletons";
import { TimingTemplateStagesPanel } from "@/components/domain/timing/timing-template-stages-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProducer, useTimingTemplate, useUpdateTimingTemplate } from "@/lib/api/hooks";
import { CROP_LABELS } from "@/lib/season-constants";

export default function ProducerTimingTemplateDetailPage() {
  const params = useParams<{ id: string; templateId: string }>();
  const producerId = params.id;
  const templateId = params.templateId;

  const { data: producer } = useProducer(producerId);
  const { data: template, isLoading } = useTimingTemplate(templateId);
  const updateTemplate = useUpdateTimingTemplate(templateId, producerId);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  if (isLoading) return <TemplateEditorSkeleton />;
  if (!template) {
    return (
      <EmptyState
        icon={Clock}
        title="Modelo não encontrado"
        description="O modelo pode ter sido removido ou você não tem acesso."
        action={
          <Button asChild variant="outline">
            <Link href={`/producers/${producerId}`}>Voltar ao produtor</Link>
          </Button>
        }
      />
    );
  }

  const sortedStages = [...(template.stages ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );
  const cropLabel = CROP_LABELS[template.crop] ?? template.crop;
  const producerHref = `/producers/${producerId}`;

  return (
    <div className="animate-fade-in space-y-6">
      <BreadcrumbBack
        items={[
          { label: "Produtores", href: "/producers" },
          { label: producer?.name ?? "Produtor", href: producerHref },
          { label: "Modelos de Recomendação", href: `${producerHref}#timing-templates` },
          { label: template.name },
        ]}
      />

      <section className="overflow-hidden rounded-xl border border-primary/20 bg-linear-to-br from-primary/8 to-card shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Modelo de Recomendação
            </p>
            {editingName ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
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
              <>
                <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
                  {template.name}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {cropLabel} · {sortedStages.length}{" "}
                  {sortedStages.length === 1 ? "estágio" : "estágios"}
                  {producer ? ` · ${producer.name}` : ""}
                </p>
              </>
            )}
          </div>
          {!editingName ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => {
                setNameValue(template.name);
                setEditingName(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Renomear
            </Button>
          ) : null}
        </div>
      </section>

      <TimingTemplateStagesPanel template={template} producerId={producerId} />
    </div>
  );
}
