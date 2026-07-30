"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Plus, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/domain/page-header";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { StatusBadge } from "@/components/domain/status-badge";
import { DataTable } from "@recomenda/ui/patterns/data-table";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@recomenda/ui/primitives/sheet";
import { apiErrorMessage } from "@recomenda/api/api-error";
import type { Organization } from "@recomenda/api/admin";
import {
  useOrganizations,
  useCreateOrganization,
  useAddOrganizationAdmin,
  useOrganizationMembers,
} from "@recomenda/api-hooks";

const orgSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  slug: z.string().optional(),
});

const adminSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha com ao menos 6 caracteres"),
});

type OrgForm = z.infer<typeof orgSchema>;
type AdminForm = z.infer<typeof adminSchema>;

export default function AdminEquipesPage() {
  const { data, isLoading } = useOrganizations();
  const createOrg = useCreateOrganization();
  const addAdmin = useAddOrganizationAdmin();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Organization | null>(null);

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const { data: members } = useOrganizationMembers(selected?.id ?? "");

  const orgForm = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    defaultValues: { name: "", slug: "" },
  });

  const adminForm = useForm<AdminForm>({
    resolver: zodResolver(adminSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onCreateOrg(values: OrgForm) {
    try {
      await createOrg.mutateAsync({
        name: values.name,
        slug: values.slug?.trim() || null,
      });
      toast.success("Equipe criada");
      orgForm.reset();
      setCreateOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível criar a equipe."));
    }
  }

  async function onAddAdmin(values: AdminForm) {
    if (!selected) return;
    try {
      await addAdmin.mutateAsync({ id: selected.id, payload: values });
      toast.success("Admin da equipe adicionado");
      adminForm.reset();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível adicionar o admin."));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipes"
        description="Organizações (ex.: 250K) que gerenciam seus próprios agrônomos."
        icon={<Building2 className="size-5" />}
        action={
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Nova equipe
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Nova equipe organizacional</SheetTitle>
              </SheetHeader>
              <form
                className="mt-6 space-y-4"
                onSubmit={orgForm.handleSubmit(onCreateOrg)}
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" {...orgForm.register("name")} placeholder="250K" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (opcional)</Label>
                  <Input id="slug" {...orgForm.register("slug")} placeholder="250k" />
                </div>
                <Button type="submit" disabled={createOrg.isPending} className="w-full">
                  Criar
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      {isLoading ? (
        <TableRowsSkeleton rows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          title="Nenhuma equipe"
          description="Crie a primeira organização para vincular agrônomos."
        />
      ) : (
        <DataTable
          headers={["Nome", "Admins / Agrônomos", "Status", ""]}
          rows={list.map((row) => [
            row.name,
            `${row.members_count} / ${row.agronomists_count}`,
            row.is_active ? (
              <StatusBadge tone="success">Ativa</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Inativa</StatusBadge>
            ),
            <Button key={row.id} variant="outline" size="sm" onClick={() => setSelected(row)}>
              Gerenciar
            </Button>,
          ])}
        />
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-medium">Admins da equipe</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {(members ?? []).map((m) => (
                  <li key={m.user_id}>
                    {m.name} · {m.email}
                  </li>
                ))}
                {(members ?? []).length === 0 ? <li>Nenhum admin ainda.</li> : null}
              </ul>
            </div>
            <form className="space-y-3" onSubmit={adminForm.handleSubmit(onAddAdmin)}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <UserPlus className="size-4" />
                Adicionar admin
              </div>
              <Input placeholder="Nome" {...adminForm.register("name")} />
              <Input placeholder="E-mail" type="email" {...adminForm.register("email")} />
              <Input
                placeholder="Senha temporária"
                type="password"
                {...adminForm.register("password")}
              />
              <Button type="submit" disabled={addAdmin.isPending} className="w-full">
                Salvar admin
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
