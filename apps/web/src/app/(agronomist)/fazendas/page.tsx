"use client";

import { routes } from "@recomenda/config";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/domain/page-header";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCreateFarm, useFarms } from "@/lib/api/hooks";
import { useCan } from "@/lib/auth/use-can";
import { Building2, Info, Plus } from "lucide-react";

const createSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  location: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

export default function FarmsPage() {
  const router = useRouter();
  const { data, isLoading } = useFarms();
  const createMutation = useCreateFarm();
  const canCreateFarm = useCan("FARM_CREATE");
  const [open, setOpen] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterLocation, setFilterLocation] = useState("");

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", location: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate(values, {
      onSuccess: (farm) => {
        setOpen(false);
        form.reset();
        router.push(routes.fazendas.detalhe(farm.id));
      },
    });
  });

  const filteredFarms = useMemo(() => {
    return data?.data?.filter((farm) => {
      const nameMatch = farm.name.toLowerCase().includes(filterName.toLowerCase());
      const locationMatch = (farm.location ?? "").toLowerCase().includes(filterLocation.toLowerCase());
      return nameMatch && locationMatch;
    }) ?? [];
  }, [data, filterName, filterLocation]);

  const rows = filteredFarms.map((farm) => [
    <Link
      key={farm.id}
      href={routes.fazendas.detalhe(farm.id)}
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {farm.name}
    </Link>,
    farm.location ?? "—",
    <Button
      key={`edit-${farm.id}`}
      variant="outline"
      size="sm"
      onClick={() => router.push(routes.fazendas.detalhe(farm.id))}
    >
      Abrir
    </Button>,
  ]);

  return (
    <>
      <PageHeader
        icon={<Building2 className="h-5 w-5" />}
        section="Estrutura"
        title="Fazendas"
        description="Cadastro e gestão de fazendas e talhões."
      />

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>Esta listagem permanece disponível como atalho.</AlertTitle>
        <AlertDescription>
          O fluxo recomendado agora é:{" "}
          <Link href={routes.produtores.lista} className="font-medium text-primary underline-offset-4 hover:underline">
            Produtores
          </Link>{" "}
          → Fazenda → Safra.
        </AlertDescription>
      </Alert>

      {canCreateFarm ? (
      <div className="mb-6 flex justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Nova fazenda
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-96">
            <SheetHeader>
              <SheetTitle>Nova fazenda</SheetTitle>
            </SheetHeader>
            <form onSubmit={onSubmit} className="space-y-4 px-4 pb-4">
              <div className="space-y-1.5">
                <Label htmlFor="farm-name">Nome da fazenda</Label>
                <Input
                  id="farm-name"
                  {...form.register("name")}
                  placeholder="Ex.: Fazenda Santa Rosa"
                  autoFocus
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="farm-location">Localização</Label>
                <Input
                  id="farm-location"
                  {...form.register("location")}
                  placeholder="Ex.: Chapadão do Sul, MS"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                  {createMutation.isPending ? "Criando…" : "Criar"}
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>
      ) : null}

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          placeholder="Filtrar por nome…"
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
        />
        <Input
          placeholder="Filtrar por localização…"
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
        />
      </div>

      {isLoading ? (
        <TableRowsSkeleton rows={8} columns={3} />
      ) : filteredFarms.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={
            data?.data?.length === 0
              ? "Nenhuma fazenda cadastrada"
              : "Nenhuma fazenda encontrada"
          }
          description={
            data?.data?.length === 0
              ? "Crie a primeira fazenda para começar a planejar suas safras."
              : "Ajuste os filtros para encontrar a fazenda desejada."
          }
          action={
            data?.data?.length === 0 && canCreateFarm ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
                Nova fazenda
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable headers={["Nome", "Localização", ""]} rows={rows} />
      )}
    </>
  );
}
