"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { PageHero } from "@/components/domain/page-hero";
import { useConsultants, useCreateInvitation, useMe } from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { useCan } from "@recomenda/api-hooks/use-can";
import { cn } from "@recomenda/utils";
import { routes } from "@recomenda/config";
import type { TeamMemberRow } from "@recomenda/api/consultants";
import type { AccessLevel } from "@recomenda/api/auth-types";

export function ConsultantsView() {
  const { data: team, isLoading } = useConsultants();
  const canManage = useCan("TEAM_MANAGE");
  const [inviteOpen, setInviteOpen] = useState(false);

  const managers = team?.managers ?? [];
  const assistants = team?.assistants ?? [];
  const empty = !isLoading && managers.length === 0 && assistants.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8">
      <PageHero
        className="mb-4"
        icon={<Users className="size-6" />}
        eyebrow="Organização"
        title="Equipe"
        actions={
          canManage ? (
            <Button onClick={() => setInviteOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Convidar
            </Button>
          ) : undefined
        }
        stats={[
          { label: "Gestores", value: isLoading ? "…" : managers.length },
          { label: "Consultores", value: isLoading ? "…" : assistants.length },
        ]}
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : empty ? (
        <EmptyState
          title="Nenhum membro na equipe ainda."
          description="Convide um gestor ou consultor e compartilhe os produtores que ele deve acompanhar."
        />
      ) : (
        <div className="flex flex-col gap-10">
          {managers.length > 0 ? (
            <TeamSection
              title="Gestores"
              microcopy="criam produtores, fazendas e recomendações"
              members={managers}
              variant="manager"
            />
          ) : null}
          <TeamSection
            title="Consultores"
            microcopy="visualizam produtores compartilhados e registram aplicações"
            members={assistants}
            variant="assistant"
            emptyLabel={
              managers.length > 0
                ? "Nenhum consultor ainda. Convide um ou peça a um gestor para criar."
                : undefined
            }
          />
        </div>
      )}

      {canManage ? (
        <InviteTeamDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          managers={managers}
        />
      ) : null}
    </div>
  );
}

function TeamSection({
  title,
  microcopy,
  members,
  variant,
  emptyLabel,
}: {
  title: string;
  microcopy: string;
  members: TeamMemberRow[];
  variant: "manager" | "assistant";
  emptyLabel?: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-[#2B2723]">
          {title}{" "}
          <span className="font-semibold text-[#8A857D]">({members.length})</span>
        </h2>
        <p className="text-sm text-[#8A857D]">· {microcopy}</p>
      </div>
      {members.length === 0 ? (
        emptyLabel ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : null
      ) : (
        <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(360px,1fr))]">
          {members.map((m) => (
            <li key={m.user_id}>
              <MemberCard member={m} variant={variant} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MemberCard({
  member,
  variant,
}: {
  member: TeamMemberRow;
  variant: "manager" | "assistant";
}) {
  const initial = (member.name ?? "?").trim().charAt(0).toUpperCase();
  const isManager = variant === "manager";

  return (
    <Link
      href={routes.equipe.membro(member.user_id)}
      className="group flex w-full flex-col gap-3 rounded-2xl border border-transparent bg-white px-[22px] py-5 shadow-sm transition-all hover:border-[#CBDDD2] hover:shadow-[0_4px_14px_rgba(30,92,64,0.08)]"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold",
            isManager ? "bg-[#1E5C40] text-white" : "bg-[#EDE9E2] text-[#5C564E]",
          )}
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[17px] font-bold text-[#2B2723]">
              {member.name ?? (isManager ? "Gestor" : "Consultor")}
            </p>
            {isManager ? (
              <span className="rounded-full bg-[#E4EEE7] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#1E6B4A]">
                Gestor
              </span>
            ) : null}
            {!member.is_active ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Inativo
              </span>
            ) : null}
          </div>
          <p className="truncate text-[13px] text-[#8A857D]">{member.email ?? "—"}</p>
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-[#B5AFA5] transition group-hover:text-[#1E6B4A]" />
      </div>
      <div className="flex items-center justify-between border-t border-[#F1EEE8] pt-3 text-[13px] text-[#6B655C]">
        {isManager ? (
          <p>
            <strong className="text-[#2B2723]">{member.assistant_count}</strong>{" "}
            {member.assistant_count === 1 ? "consultor" : "consultores"}
            {" · "}
            <strong className="text-[#2B2723]">{member.producer_count}</strong>{" "}
            {member.producer_count === 1 ? "produtor" : "produtores"}
          </p>
        ) : (
          <>
            <p>
              <strong className="text-[#2B2723]">{member.producer_count}</strong>{" "}
              {member.producer_count === 1 ? "produtor" : "produtores"}
            </p>
            <VinculoChip
              managerName={member.manager_name}
              managerUserId={member.manager_user_id}
            />
          </>
        )}
      </div>
    </Link>
  );
}

function VinculoChip({
  managerName,
  managerUserId,
}: {
  managerName: string | null;
  managerUserId: string | null;
}) {
  if (managerUserId && managerName) {
    return (
      <span className="rounded-full bg-[#E4EEE7] px-2.5 py-0.5 text-[12px] font-medium text-[#1E6B4A]">
        via {managerName}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[#F3EEDD] px-2.5 py-0.5 text-[12px] font-medium text-[#7A6B3F]">
      direto com você
    </span>
  );
}

function InviteTeamDialog({
  open,
  onOpenChange,
  managers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managers: TeamMemberRow[];
}) {
  const { data: me } = useMe();
  const createInvitation = useCreateInvitation();
  const isStaffManager = me?.role === "STAFF" && me?.access_level === "MANAGER";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccessLevel>("MANAGER");
  const [vinculo, setVinculo] = useState<"direto" | string>("direto");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const emailValid = /.+@.+\..+/.test(email.trim());
  const effectiveRole: AccessLevel = isStaffManager ? "ASSISTANT" : role;

  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setEmail("");
      setRole(isStaffManager ? "ASSISTANT" : "MANAGER");
      setVinculo("direto");
      setLink(null);
    }
  }

  const submit = async () => {
    try {
      const payload: Parameters<typeof createInvitation.mutateAsync>[0] = {
        email: email.trim(),
        kind: "CONSULTANT",
        access_level: effectiveRole,
        farm_ids: [],
      };
      if (effectiveRole === "ASSISTANT" && !isStaffManager) {
        payload.manager_user_id = vinculo === "direto" ? null : vinculo;
      }
      const res = await createInvitation.mutateAsync(payload);
      const full = `${window.location.origin}${routes.convite(res.token)}`;
      setLink(full);
      toast.success("Convite criado. Envie o link ao membro.");
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
      <DialogContent className="max-w-[560px] rounded-[20px] p-0">
        <DialogHeader className="px-7 pt-7">
          <DialogTitle className="text-[21px] font-extrabold">Convidar para a equipe</DialogTitle>
          <DialogDescription>
            Escolha o papel e envie o convite por e-mail. O compartilhamento de produtores é
            feito depois, no detalhe do membro.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 px-7 py-5">
          {link ? (
            <div className="flex flex-col gap-2">
              <Label>Link de convite</Label>
              <div className="flex gap-2">
                <Input readOnly value={link} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copy} title="Copiar">
                  {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {!isStaffManager ? (
                <div className="grid grid-cols-2 gap-3">
                  <RoleCard
                    selected={effectiveRole === "MANAGER"}
                    title="Gestor"
                    description="Cria e gerencia produtores, fazendas, listas e recomendações. Pode convidar consultores."
                    onClick={() => setRole("MANAGER")}
                  />
                  <RoleCard
                    selected={effectiveRole === "ASSISTANT"}
                    title="Consultor"
                    description="Visualiza produtores compartilhados e registra aplicações das recomendações."
                    onClick={() => setRole("ASSISTANT")}
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-[#D9E6DD] bg-[#F2F7F3] px-4 py-3 text-sm text-[#2B2723]">
                  Você está convidando um <strong>Consultor</strong>, que ficará vinculado a você.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="team-email">E-mail</Label>
                <Input
                  id="team-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@empresa.com"
                  className="rounded-xl"
                />
              </div>

              {effectiveRole === "ASSISTANT" && !isStaffManager ? (
                <div className="space-y-2">
                  <Label>Vínculo</Label>
                  <ul className="flex flex-col gap-2">
                    <VinculoOption
                      selected={vinculo === "direto"}
                      label="Direto com você"
                      onClick={() => setVinculo("direto")}
                    />
                    {managers.map((m) => (
                      <VinculoOption
                        key={m.user_id}
                        selected={vinculo === m.user_id}
                        label={`Sob o gestor ${m.name ?? m.email ?? "—"}`}
                        onClick={() => setVinculo(m.user_id)}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={submit}
                  disabled={createInvitation.isPending || !emailValid}
                  className="gap-2"
                >
                  {createInvitation.isPending ? "Enviando…" : "Enviar convite"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoleCard({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[14px] border-2 p-4 text-left transition",
        selected
          ? "border-[#1E6B4A] bg-[#F2F7F3]"
          : "border-[#EDEAE4] bg-white hover:border-[#CBDDD2]",
      )}
    >
      <p className="text-sm font-bold text-[#2B2723]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[#6B655C]">{description}</p>
    </button>
  );
}

function VinculoOption({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition",
          selected
            ? "border-[#1E6B4A] bg-[#F2F7F3] text-[#2B2723]"
            : "border-[#EDEAE4] bg-white text-[#6B655C] hover:border-[#CBDDD2]",
        )}
      >
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
            selected ? "border-[#1E6B4A]" : "border-[#C9C4BB]",
          )}
        >
          {selected ? <span className="h-2 w-2 rounded-full bg-[#1E6B4A]" /> : null}
        </span>
        {label}
      </button>
    </li>
  );
}
