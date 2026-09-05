"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@recomenda/ui/primitives/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { Select } from "@recomenda/ui/forms/select";
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

  function resetForm() {
    form.reset({
      name: "",
      email: "",
      password: "",
      access_level: "FARM_OPERATOR",
    });
    setGrantKeys(defaultFarmStaffGrantKeys("FARM_OPERATOR"));
  }

  async function onSubmit(values: FormValues) {
    try {
      await createMutation.mutateAsync({
        producer_id: producerId,
        ...values,
        grant_keys: grantKeys,
        can_view_prices: grantKeys.includes("prices"),
      });
      toast.success("Membro adicionado");
      resetForm();
      setOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível adicionar o membro."));
    }
  }

  const members = Array.isArray(data) ? data : [];

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b border-border py-4 has-data-[slot=card-action]:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
            <Users className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <CardTitle>Equipe da fazenda</CardTitle>
            <CardDescription>
              Gerentes e operadores com acesso a este produtor.
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
            <UserPlus className="size-4" aria-hidden />
            Adicionar
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0 py-0">
        {isLoading ? (
          <p className="px-6 py-5 text-sm text-muted-foreground">Carregando…</p>
        ) : members.length === 0 ? (
          <p className="px-6 py-5 text-sm text-muted-foreground">
            Nenhum gerente ou operador cadastrado.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-3 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-text-strong">{m.name}</div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
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
                  className="self-start text-danger-strong hover:bg-danger-soft sm:self-center"
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
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent className="w-full min-w-0 max-w-[min(36rem,calc(100vw-2rem))] p-0">
          <DialogHeader className="shrink-0">
            <DialogTitle>Novo membro</DialogTitle>
            <DialogDescription>
              Cadastre gerente ou operador com senha temporária e as permissões deste produtor.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex min-h-0 min-w-0 flex-1 flex-col"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-6 py-5">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="farm-team-role">Papel</Label>
                <Select
                  id="farm-team-role"
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
              <div className="min-w-0 space-y-2">
                <Label htmlFor="farm-team-name">Nome</Label>
                <Input id="farm-team-name" autoComplete="name" {...form.register("name")} />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="farm-team-email">E-mail</Label>
                <Input
                  id="farm-team-email"
                  type="email"
                  autoComplete="email"
                  {...form.register("email")}
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="farm-team-password">Senha temporária</Label>
                <Input
                  id="farm-team-password"
                  type="password"
                  autoComplete="new-password"
                  {...form.register("password")}
                />
              </div>
            </div>
            <DialogFooter className="shrink-0 flex-row justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
