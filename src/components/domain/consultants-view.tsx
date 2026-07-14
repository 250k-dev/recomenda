"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Tractor, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useConsultants,
  useCreateInvitation,
  useFarms,
  useRemoveConsultant,
} from "@/lib/api/hooks";
import { apiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import type { ConsultantRow } from "@/lib/api/consultants";

export function ConsultantsView() {
  const { data: consultants, isLoading } = useConsultants();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toRemove, setToRemove] = useState<ConsultantRow | null>(null);
  const removeMutation = useRemoveConsultant();

  const confirmRemove = async () => {
    if (!toRemove) return;
    try {
      await removeMutation.mutateAsync(toRemove.user_id);
      toast.success("Consultor removido.");
      setToRemove(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível remover o consultor."));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Consultores</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Convide consultores e compartilhe fazendas específicas. Eles acessam apenas as
              fazendas liberadas, podendo gerenciar tudo nelas como você.
            </p>
          </div>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Convidar consultor
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !consultants || consultants.length === 0 ? (
        <EmptyState
          title="Nenhum consultor ainda."
          description="Convide um consultor e compartilhe as fazendas que ele deve acompanhar."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {consultants.map((c) => (
            <li key={c.user_id} className="relative">
              <Link
                href={`/consultants/${c.user_id}`}
                className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2 pr-8">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-strong">{c.name ?? "Consultor"}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.email ?? "—"}</p>
                  </div>
                  {!c.is_active ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Inativo
                    </span>
                  ) : null}
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Tractor className="h-3.5 w-3.5" />
                  {c.farm_count} {c.farm_count === 1 ? "fazenda" : "fazendas"}
                  <span>·</span>
                  <span className="text-primary-strong">ver atividade e gerenciar</span>
                </p>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Remover consultor"
                className="absolute right-3 top-3 text-muted-foreground hover:text-danger-strong"
                onClick={() => setToRemove(c)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <InviteConsultantDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <ConfirmDialog
        open={toRemove != null}
        onOpenChange={(open) => !open && setToRemove(null)}
        title="Remover consultor?"
        description={
          toRemove
            ? `${toRemove.name ?? "O consultor"} perderá o acesso e o login será desativado.`
            : undefined
        }
        tone="destructive"
        confirmLabel="Remover"
        loading={removeMutation.isPending}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

function InviteConsultantDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: farmsData } = useFarms();
  const farms = farmsData?.data ?? [];
  const createInvitation = useCreateInvitation();

  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // E-mail é obrigatório: é por ele que o consultor faz login.
  const emailValid = /.+@.+\..+/.test(email.trim());

  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setEmail("");
      setSelected(new Set());
      setLink(null);
    }
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    try {
      const res = await createInvitation.mutateAsync({
        email: email.trim(),
        farm_ids: [...selected],
        kind: "CONSULTANT",
      });
      const full = `${window.location.origin}/invite/${res.token}`;
      setLink(full);
      toast.success("Convite criado. Envie o link ao consultor.");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível criar o convite."));
    }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar consultor</DialogTitle>
          <DialogDescription>
            Gere um link de convite. O consultor cria a senha e acessa só as fazendas liberadas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-5">
          {link ? (
            <div className="flex flex-col gap-2">
              <Label>Link de convite</Label>
              <div className="flex gap-2">
                <Input readOnly value={link} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copy} title="Copiar">
                  {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Envie este link ao consultor para ele criar o acesso.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="consultant-email">E-mail</Label>
                <Input
                  id="consultant-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="consultor@exemplo.com"
                />
                <p className="text-xs text-muted-foreground">
                  É com este e-mail que o consultor vai fazer login.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Fazendas compartilhadas</Label>
                {farms.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Você ainda não tem fazendas.</p>
                ) : (
                  <ul className="flex max-h-52 flex-col gap-1 overflow-y-auto">
                    {farms.map((f) => {
                      const on = selected.has(f.id);
                      return (
                        <li key={f.id}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                              on ? "border-primary/40 bg-primary/5" : "border-border bg-card",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={on}
                              onChange={() => toggle(f.id)}
                            />
                            <span className="font-medium text-text-strong">{f.name}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <Button
                onClick={submit}
                disabled={createInvitation.isPending || selected.size === 0 || !emailValid}
                className="gap-2"
              >
                {createInvitation.isPending ? "Gerando…" : "Gerar convite"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

