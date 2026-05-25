"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/page-header";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCreateFarm,
  useProducer,
} from "@/lib/api/hooks";
import { grantFarmAccess } from "@/lib/api/client";

const createSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  location: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

export default function NewFarmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const producerId = searchParams.get("producer_id");

  const { data: producer } = useProducer(producerId ?? "");
  const createMutation = useCreateFarm();

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", location: "" },
  });

  const cancelHref = producerId ? `/producers/${producerId}` : "/producers";

  const onSubmit = form.handleSubmit(async (values) => {
    createMutation.mutate(values, {
      onSuccess: async (farm) => {
        if (producerId) {
          try {
            await grantFarmAccess(farm.id, producerId);
          } catch {
            toast.error(
              "Fazenda criada, mas não foi possível vincular ao produtor automaticamente.",
            );
          }
          toast.success("Fazenda criada e vinculada ao produtor!");
          router.push(
            `/farms/${farm.id}?producer_id=${encodeURIComponent(producerId)}`,
          );
        } else {
          toast.success("Fazenda criada!");
          router.push(`/farms/${farm.id}`);
        }
      },
      onError: (error) => {
        toast.error(`Erro: ${(error as Error).message}`);
      },
    });
  });

  const breadcrumbs = [
    { label: "Produtores", href: "/producers" },
    ...(producerId && producer
      ? [{ label: producer.name, href: `/producers/${producerId}` }]
      : []),
    { label: "Nova fazenda" },
  ];

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      <PageHeader
        title="Nova fazenda"
        description={
          producerId && producer
            ? `Cadastre uma nova fazenda para ${producer.name}.`
            : "Cadastre uma nova fazenda."
        }
      />

      <Card className="mx-auto max-w-2xl">
        <CardContent className="p-6">
          {producerId && producer ? (
            <div className="mb-4 flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold uppercase text-primary">
                {producer.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {producer.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {producer.email}
                </p>
              </div>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Nome da fazenda
              </label>
              <Input
                {...form.register("name")}
                placeholder="Ex: Fazenda Santa Rosa"
                autoFocus
              />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Localização
              </label>
              <Input
                {...form.register("location")}
                placeholder="Ex: Chapadão do Sul, MS"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1"
              >
                {createMutation.isPending ? "Criando..." : "Criar fazenda"}
              </Button>
              <Link href={cancelHref}>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
