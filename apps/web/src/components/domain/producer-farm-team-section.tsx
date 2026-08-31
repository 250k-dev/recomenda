"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { Select } from "@recomenda/ui/forms/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@recomenda/ui/primitives/sheet";
import { apiErrorMessage } from "@recomenda/api/api-error";
import {
  useCan,
  useCreateFarmTeamMember,
  useDeleteFarmTeamMember,
  useFarmTeam,
} from "@recomenda/api-hooks";
import { FarmStaffGrantsPalette } from "@/components/domain/farm-staff-grants-palette";
import {
  defaultFarmStaffGrantKeys,
  type FarmStaffGrantKey,
} from "@recomenda/domain";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  access_level: z.enum(["FARM_MANAGER", "FARM_OPERATOR"]),
});

type FormValues = z.infer<typeof schema>;

function levelLabel(level: string) {
  return level === "FARM_MANAGER" ? "Gerente" : "Operador";
}

export function ProducerFarmTeamSection({ producerId }: { producerId: string }) {
  const canManage = useCan("FARM_TEAM_MANAGE");
  const { data, isLoading } = useFarmTeam(producerId);
  const createMutation = useCreateFarmTeamMember();
  const deleteMutation = useDeleteFarmTeamMember(producerId);
  const [open, setOpen] = useState(false);
  const [grantKeys, setGrantKeys] = useState<FarmStaffGrantKey[]>(
    defaultFarmStaffGrantKeys("FARM_OPERATOR"),
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      access_level: "FARM_OPERATOR",
    },
  });

  if (!canManage) return null;

  async function onSubmit(values: FormValues) {
    try {
      await createMutation.mutateAsync({
        producer_id: producerId,
        ...values,
        grant_keys: grantKeys,
        can_view_prices: grantKeys.includes("prices"),
      });
      toast.success("Membro adicionado");
      form.reset({
        name: "",
        email: "",
        password: "",
        access_level: "FARM_OPERATOR",
      });
      setGrantKeys(defaultFarmStaffGrantKeys("FARM_OPERATOR"));
      setOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível adicionar o membro."));
    }
  }

  const members = Array.isArray(data) ? data : [];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="size-4" />
          <h2 className="text-base font-semibold">Equipe da fazenda</h2>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm" variant="outline">
              Adicionar
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Novo membro</SheetTitle>
            </SheetHeader>
            <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label>Papel</Label>
                <Select
                  value={form.watch("access_level")}
                  options={[
                    { value: "FARM_MANAGER", label: "Gerente" },
                    { value: "FARM_OPERATOR", label: "Operador" },
                  ]}
                  onValueChange={(v) => {
                    const level = v as FormValues["access_level"];
                    form.setValue("access_level", level);
                    setGrantKeys(defaultFarmStaffGrantKeys(level));
                  }}
                />
              </div>
              <FarmStaffGrantsPalette
                level={form.watch("access_level")}
                selected={grantKeys}
                onChange={setGrantKeys}
              />
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input {...form.register("name")} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" {...form.register("email")} />
              </div>
              <div className="space-y-2">
                <Label>Senha temporária</Label>
                <Input type="password" {...form.register("password")} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                Salvar
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum gerente ou operador cadastrado.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-muted-foreground">
                  {levelLabel(m.access_level)}
                  {(m.permission_grants ?? []).includes("prices") || m.can_view_prices
                    ? " · vê preços"
                    : ""}{" "}
                  · {m.email}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={deleteMutation.isPending}
                onClick={async () => {
                  try {
                    await deleteMutation.mutateAsync(m.id);
                    toast.success("Removido");
                  } catch (err) {
                    toast.error(apiErrorMessage(err, "Não foi possível remover."));
                  }
                }}
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
