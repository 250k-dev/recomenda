"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/domain/page-header";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { DataTable } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCreateFarm, useFarms } from "@/lib/api/hooks";

const createSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  location: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

export default function FarmsPage() {
  const router = useRouter();
  const { data, isLoading } = useFarms();
  const createMutation = useCreateFarm();
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
        router.push(`/farms/${farm.id}`);
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
    <Link key={farm.id} href={`/farms/${farm.id}`} className="font-medium text-[var(--brand)] underline">
      {farm.name}
    </Link>,
    farm.location ?? "-",
    <Button
      key={`edit-${farm.id}`}
      variant="outline"
      className="h-8 px-3 text-xs"
      onClick={() => {
        const url = `/farms/${farm.id}`;
        window.location.href = url;
      }}
    >
      Editar
    </Button>,
  ]);

  return (
    <>
      <PageHeader title="Fazendas" description="Cadastro e gestão de fazendas e talhões." />

      <div className="mb-6 flex justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button>Nova fazenda</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-96">
            <SheetHeader>
              <SheetTitle>Criar nova fazenda</SheetTitle>
            </SheetHeader>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">Nome da fazenda</label>
                <Input
                  {...form.register("name")}
                  placeholder="Ex: Fazenda Santa Rosa"
                  autoFocus
                />
                {form.formState.errors.name && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">Localização</label>
                <Input
                  {...form.register("location")}
                  placeholder="Ex: Chapadão do Sul, MS"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                  {createMutation.isPending ? "Criando..." : "Criar"}
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          placeholder="Filtrar por nome..."
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          className="text-sm"
        />
        <Input
          placeholder="Filtrar por localização..."
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          className="text-sm"
        />
      </div>

      {isLoading ? (
        <TableRowsSkeleton rows={8} columns={3} />
      ) : filteredFarms.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          {data?.data?.length === 0 ? "Nenhuma fazenda cadastrada" : "Nenhuma fazenda encontrada"}
        </p>
      ) : (
        <DataTable headers={["Nome", "Localização", ""]} rows={rows} />
      )}
    </>
  );
}
