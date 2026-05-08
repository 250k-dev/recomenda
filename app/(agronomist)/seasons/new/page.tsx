"use client";

import Link from "next/link";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/domain/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useCreateSeason,
  useProducers,
  useTimingTemplates,
  useFarms,
  useFarmPlots,
} from "@/lib/api/hooks";
import { activeAgronomistProducerAccounts } from "@/lib/api/client";
import { useMemo, useState } from "react";

const seasonSchema = z.object({
  plot_id: z.string().min(1, "Talhão obrigatório"),
  producer_id: z.string().min(1, "Produtor obrigatório"),
  crop: z.enum(["SOYBEAN", "CORN"]),
  variety: z.string().min(1, "Variedade obrigatória"),
  cycle_days: z.number().int().min(1, "Dias de ciclo obrigatório"),
  timing_template_id: z.string().min(1, "Template de timing obrigatório"),
  desiccation_date: z.string().min(1, "Data de dessecação obrigatória"),
});

type SeasonFormValues = z.infer<typeof seasonSchema>;

export default function NewSeasonPage() {
  const router = useRouter();
  const [selectedProducerSearch, setSelectedProducerSearch] = useState("");
  const [selectedFarmId, setSelectedFarmId] = useState("");

  const { data: producersData } = useProducers();
  const { data: farmsData } = useFarms();
  const { data: plotsData } = useFarmPlots(selectedFarmId);
  const { data: templatesData } = useTimingTemplates();
  const createSeasonMutation = useCreateSeason();

  const form = useForm<SeasonFormValues>({
    resolver: zodResolver(seasonSchema),
    defaultValues: {
      crop: "SOYBEAN",
      cycle_days: 120,
    },
  });

  const producers = useMemo(() => activeAgronomistProducerAccounts(producersData?.data ?? []), [producersData]);
  const farms = useMemo(() => farmsData?.data ?? [], [farmsData]);
  const plots = useMemo(() => plotsData ?? [], [plotsData]);
  const templates = useMemo(() => templatesData ?? [], [templatesData]);

  const filteredProducers = useMemo(
    () =>
      selectedProducerSearch
        ? producers.filter(
            (p) =>
              p.name.toLowerCase().includes(selectedProducerSearch.toLowerCase()) ||
              p.email.toLowerCase().includes(selectedProducerSearch.toLowerCase()),
          )
        : producers,
    [selectedProducerSearch, producers],
  );

  const submit = form.handleSubmit((values) => {
    createSeasonMutation.mutate(
      {
        ...values,
        stages_overrides: [],
        initial_stock: [],
        publish_now: false,
      },
      {
        onSuccess: () => router.push("/seasons"),
        onError: (error) => {
          alert("Erro: " + (error as Error).message);
        },
      },
    );
  });

  return (
    <>
      <Link href="/seasons" className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        ← Voltar
      </Link>

      <PageHeader
        title="Nova safra"
        description="Preencha os dados para criar uma nova safra em rascunho."
      />

      <Card>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              Produtor
            </label>
            <input
              type="text"
              placeholder="Buscar por nome ou email"
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]"
              value={selectedProducerSearch}
              onChange={(e) => setSelectedProducerSearch(e.target.value)}
            />
            {selectedProducerSearch && filteredProducers.length > 0 && (
              <div className="relative mt-1">
                <div className="absolute top-0 left-0 z-10 w-full rounded border border-zinc-200 bg-white shadow-lg">
                  {filteredProducers.slice(0, 5).map((p) => (
                    <button
                      key={p.producer_id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100"
                      onClick={() => {
                        form.setValue("producer_id", p.producer_id);
                        setSelectedProducerSearch(`${p.name} (${p.email})`);
                      }}
                    >
                      {p.name} ({p.email})
                    </button>
                  ))}
                </div>
              </div>
            )}
            {form.watch("producer_id") && (
              <p className="mt-1 text-xs text-green-600">
                ✓ {producers.find((p) => p.producer_id === form.watch("producer_id"))?.name}
              </p>
            )}
            {form.formState.errors.producer_id && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.producer_id.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              Fazenda
            </label>
            <select
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]"
              value={selectedFarmId}
              onChange={(e) => {
                setSelectedFarmId(e.target.value);
                form.setValue("plot_id", "");
              }}
            >
              <option value="">Selecione uma fazenda</option>
              {farms.map((f: any) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              Talhão
            </label>
            <select
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)] disabled:bg-zinc-100"
              {...form.register("plot_id")}
              disabled={!selectedFarmId}
            >
              <option value="">Selecione um talhão</option>
              {plots.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.area_hectares} ha)
                </option>
              ))}
            </select>
            {form.formState.errors.plot_id && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.plot_id.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              Template de Timing
            </label>
            <select
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]"
              {...form.register("timing_template_id")}
            >
              <option value="">Selecione um template</option>
              {templates.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.crop === "SOYBEAN" ? "Soja" : "Milho"})
                </option>
              ))}
            </select>
            {form.formState.errors.timing_template_id && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.timing_template_id.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              Cultura
            </label>
            <select
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]"
              {...form.register("crop")}
            >
              <option value="SOYBEAN">Soja</option>
              <option value="CORN">Milho</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              Variedade
            </label>
            <Input placeholder="Ex: NS 5090" {...form.register("variety")} />
            {form.formState.errors.variety && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.variety.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              Dias de Ciclo
            </label>
            <Input
              type="number"
              placeholder="Ex: 120"
              {...form.register("cycle_days", { valueAsNumber: true })}
            />
            {form.formState.errors.cycle_days && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.cycle_days.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              Data de Dessecação
            </label>
            <Input type="date" {...form.register("desiccation_date")} />
            {form.formState.errors.desiccation_date && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.desiccation_date.message}
              </p>
            )}
          </div>

          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" disabled={createSeasonMutation.isPending}>
              {createSeasonMutation.isPending ? "Salvando..." : "Salvar como rascunho"}
            </Button>
            <Link href="/seasons">
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </>
  );
}
