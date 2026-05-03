"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/domain/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateSeason } from "@/lib/api/hooks";

const seasonSchema = z.object({
  plot_id: z.string().min(1),
  producer_id: z.string().min(1),
  crop: z.enum(["SOYBEAN", "CORN"]),
  variety: z.string().min(1),
  cycle_days: z.number().int().min(1),
  timing_template_id: z.string().min(1),
  desiccation_date: z.string().min(1),
});

type SeasonFormValues = z.infer<typeof seasonSchema>;

export default function NewSeasonPage() {
  const createSeasonMutation = useCreateSeason();
  const form = useForm<SeasonFormValues>({
    resolver: zodResolver(seasonSchema),
    defaultValues: {
      crop: "SOYBEAN",
      cycle_days: 120,
    },
  });

  const submit = form.handleSubmit((values) => {
    createSeasonMutation.mutate({
      ...values,
      stages_overrides: [],
      initial_stock: [],
      publish_now: false,
    });
  });

  return (
    <>
      <PageHeader
        title="Nova safra"
        description="Wizard simplificado para criação de safra em rascunho."
      />
      <Card>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
          <Input placeholder="Plot ID" {...form.register("plot_id")} />
          <Input placeholder="Producer ID" {...form.register("producer_id")} />
          <Input placeholder="SOYBEAN ou CORN" {...form.register("crop")} />
          <Input placeholder="Variedade" {...form.register("variety")} />
          <Input
            type="number"
            placeholder="Dias de ciclo"
            {...form.register("cycle_days", { valueAsNumber: true })}
          />
          <Input
            placeholder="Timing Template ID"
            {...form.register("timing_template_id")}
          />
          <Input type="date" {...form.register("desiccation_date")} />
          <div className="md:col-span-2">
            <Button type="submit" disabled={createSeasonMutation.isPending}>
              {createSeasonMutation.isPending ? "Salvando..." : "Salvar como rascunho"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
