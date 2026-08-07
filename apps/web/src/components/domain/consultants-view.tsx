"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  MailWarning,
  Send,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { PageHero } from "@/components/domain/page-hero";
import { TeamAuditHome } from "@/components/domain/team-audit-home";
import {
  useConsultants,
  useCreateInvitation,
  useDeleteFarmTeamMember,
  useDeleteInvitation,
  useFarmTeamAll,
  useFarmTeamProducers,
  useInvitations,
  useMe,
  useResendInvitation,
  useShareableProducers,
} from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { useCan } from "@recomenda/api-hooks/use-can";
import { cn } from "@recomenda/utils";
import { routes } from "@recomenda/config";
import type { TeamMemberRow } from "@recomenda/api/consultants";
import type { FarmTeamMember } from "@recomenda/api/farm-team";
import type { InvitationRow } from "@recomenda/api/producers";
import type { AccessLevel } from "@recomenda/api/auth-types";

type TeamInviteLevel = Extract<AccessLevel, "MANAGER" | "CONSULTANT">;
type FarmInviteLevel = Extract<AccessLevel, "FARM_MANAGER" | "FARM_OPERATOR">;

export function ConsultantsView() {
  const canTeamManage = useCan("TEAM_MANAGE");
  const canFarmTeam = useCan("FARM_TEAM_MANAGE");
  // Consultor (e quem só tem equipe de fazenda): mesma tela, outro modo.
  if (canFarmTeam && !canTeamManage) {
    return <FarmTeamEquipeView />;
  }
  return <CarteiraEquipeView canManage={canTeamManage} />;
}

function FarmTeamEquipeView() {
  const { data, isLoading } = useFarmTeamAll(true);
  const remove = useDeleteFarmTeamMember();
  const [inviteOpen, setInviteOpen] = useState(false);
  const { data: invitations } = useInvitations("FARM_TEAM", { enabled: true });

  const members = Array.isArray(data) ? data : [];
  const gerentes = members.filter((m) => m.access_level === "FARM_MANAGER");
  const operadores = members.filter((m) => m.access_level === "FARM_OPERATOR");
  const pending = (invitations ?? []).filter(
    (i) => i.status !== "ACCEPTED" && i.status !== "REVOKED",
  );
  const empty =
    !isLoading && members.length === 0 && pending.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8">
      <PageHero
        className="mb-4"
        icon={<Users className="size-6" />}
        eyebrow="Fazenda"
        title="Equipe"
        actions={
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Convidar
          </Button>
        }
        stats={[
          { label: "Gerentes", value: isLoading ? "…" : gerentes.length },
          { label: "Operadores", value: isLoading ? "…" : operadores.length },
          ...(pending.length > 0
            ? [{ label: "Convites pendentes", value: pending.length }]
            : []),
        ]}
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : empty ? (
        <EmptyState
          title="Nenhum gerente ou operador ainda."
          description="Convide a equipe da fazenda por e-mail — eles definem a própria senha no convite."
        />
      ) : (
        <div className="flex flex-col gap-10">
          <FarmTeamSection
            title="Gerentes"
            microcopy="alteram recomendações e criam operadores · sem ver preços"
            members={gerentes}
            onRemove={(id) => remove.mutateAsync(id)}
            removing={remove.isPending}
          />
          <FarmTeamSection
            title="Operadores"
            microcopy="visualizam e registram aplicação · sem ver preços"
            members={operadores}
            onRemove={(id) => remove.mutateAsync(id)}
            removing={remove.isPending}
            emptyLabel={
              gerentes.length > 0 ? "Nenhum operador ainda. Convide um acima." : undefined
            }
          />
          {pending.length > 0 ? (
            <PendingInvitationsSection invitations={pending} />
          ) : null}
        </div>
      )}

      <InviteFarmTeamDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

function FarmTeamSection({
  title,
  microcopy,
  members,
  onRemove,
  removing,
  emptyLabel,
}: {
  title: string;
  microcopy: string;
  members: FarmTeamMember[];
  onRemove: (id: string) => Promise<unknown>;
  removing: boolean;
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
        emptyLabel ? <p className="text-sm text-muted-foreground">{emptyLabel}</p> : null
      ) : (
        <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(360px,1fr))]">
          {members.map((m) => (
            <li key={m.id}>
              <FarmMemberCard
                member={m}
                onRemove={onRemove}
                removing={removing}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FarmMemberCard({
  member,
  onRemove,
  removing,
}: {
  member: FarmTeamMember;
  onRemove: (id: string) => Promise<unknown>;
  removing: boolean;
}) {
  const initial = (member.name || "?").trim().charAt(0).toUpperCase();
  const isGerente = member.access_level === "FARM_MANAGER";

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-transparent bg-white px-[22px] py-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold",
            isGerente ? "bg-[#1E5C40] text-white" : "bg-[#EDE9E2] text-[#5C564E]",
          )}
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[17px] font-bold text-[#2B2723]">{member.name}</p>
            <span className="rounded-full bg-[#E4EEE7] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#1E6B4A]">
              {isGerente ? "Gerente" : "Operador"}
            </span>
          </div>
          <p className="truncate text-[13px] text-[#8A857D]">{member.email || "—"}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-danger-strong hover:bg-danger-soft"
          disabled={removing}
          onClick={async () => {
            try {
              await onRemove(member.id);
              toast.success("Membro removido.");
            } catch (e) {
              toast.error(apiErrorMessage(e, "Não foi possível remover."));
            }
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="border-t border-[#F1EEE8] pt-3 text-[13px] text-[#6B655C]">
        Produtor: <strong className="text-[#2B2723]">{member.producer_name || "—"}</strong>
      </div>
    </div>
  );
}

function InviteFarmTeamDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: me } = useMe();
  const createInvitation = useCreateInvitation();
  const isProducer = me?.role === "PRODUCER";
  const onlyOperator =
    me?.role === "STAFF" && me.access_level === "FARM_MANAGER";
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<FarmInviteLevel>("FARM_OPERATOR");
  const [producerIds, setProducerIds] = useState<string[]>([]);
  const [producerFilter, setProducerFilter] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { data: shareableProducers } = useFarmTeamProducers(open);

  const emailValid = /.+@.+\..+/.test(email.trim());
  const effectiveRole: FarmInviteLevel = onlyOperator ? "FARM_OPERATOR" : role;
  // Produtor (ou escopo com um único produtor): vínculo implícito — sem picker.
  const soleProducerId =
    shareableProducers?.length === 1
      ? shareableProducers[0].id
      : isProducer && me?.id
        ? (shareableProducers?.find((p) => p.id === me.id)?.id ?? me.id)
        : null;
  const hideProducerPicker = isProducer || shareableProducers?.length === 1;
  const resolvedProducerIds =
    hideProducerPicker && soleProducerId ? [soleProducerId] : producerIds;

  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setEmail("");
      setRole("FARM_OPERATOR");
      setProducerIds([]);
      setProducerFilter("");
      setLink(null);
      setSentTo(null);
      setCopied(false);
    }
  }

  const submit = async () => {
    if (resolvedProducerIds.length === 0) {
      toast.error("Selecione ao menos um produtor.");
      return;
    }
    try {
      const res = await createInvitation.mutateAsync({
        email: email.trim(),
        kind: "FARM_TEAM",
        access_level: effectiveRole,
        farm_ids: [],
        producer_ids: resolvedProducerIds,
      });
      const full = `${window.location.origin}${routes.convite(res.token)}`;
      setLink(full);
      if (res.email_sent) {
        setSentTo(email.trim());
        toast.success(
          hideProducerPicker
            ? `Convite enviado para ${email.trim()}.`
            : `Convite enviado para ${email.trim()} com ${resolvedProducerIds.length} produtor(es).`,
        );
      } else {
        toast.success("Convite criado. Envie o link ao membro.");
      }
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
        <DialogHeader className="shrink-0 px-7 pt-7">
          <DialogTitle className="text-[21px] font-extrabold">
            Convidar para a equipe da fazenda
          </DialogTitle>
          <DialogDescription>
            {hideProducerPicker
              ? "Escolha Gerente ou Operador e envie o convite por e-mail. A pessoa define a própria senha no link."
              : "Escolha Gerente ou Operador, os produtores e envie o convite por e-mail. A pessoa define a própria senha no link."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-7 py-5">
          {link ? (
            <div className="flex flex-col gap-3">
              {sentTo ? (
                <div className="rounded-2xl border border-[#D9E6DD] bg-[#F2F7F3] px-4 py-3 text-sm text-[#2B2723]">
                  Convite enviado para <strong>{sentTo}</strong>. Você também pode
                  copiar o link abaixo.
                </div>
              ) : (
                <div className="rounded-2xl border border-[#EDE7DC] bg-[#FBF8F1] px-4 py-3 text-sm text-[#2B2723]">
                  Convite criado. Envie o link abaixo para o convidado.
                </div>
              )}
              <div className="flex gap-2">
                <Input value={link} readOnly className="rounded-xl font-mono text-xs" />
                <Button type="button" variant="outline" onClick={copy} className="shrink-0 gap-2">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {onlyOperator ? (
                <div className="rounded-2xl border border-[#EDE7DC] bg-[#FBF8F1] px-4 py-3 text-sm text-[#2B2723]">
                  Como gerente, você convida <strong>Operadores</strong> da fazenda.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <RoleCard
                    selected={role === "FARM_MANAGER"}
                    title="Gerente"
                    description="Altera recomendações e cria operadores. Não vê preços."
                    onClick={() => setRole("FARM_MANAGER")}
                  />
                  <RoleCard
                    selected={role === "FARM_OPERATOR"}
                    title="Operador"
                    description="Só visualiza e registra aplicação. Não vê preços."
                    onClick={() => setRole("FARM_OPERATOR")}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="farm-team-email">E-mail</Label>
                <Input
                  id="farm-team-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@fazenda.com"
                  className="rounded-xl"
                />
              </div>

              {!hideProducerPicker ? (
                <ProducerPicker
                  producers={shareableProducers ?? []}
                  selected={producerIds}
                  onToggle={(id) =>
                    setProducerIds((prev) =>
                      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
                    )
                  }
                  onToggleAll={(ids) => setProducerIds(ids)}
                  filter={producerFilter}
                  onFilterChange={setProducerFilter}
                />
              ) : null}
            </>
          )}
        </div>
        {!link ? (
          <DialogFooter className="shrink-0 flex-row justify-end gap-2 px-7">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={
                createInvitation.isPending ||
                !emailValid ||
                resolvedProducerIds.length === 0
              }
              className="gap-2"
            >
              <Send className="size-4" />
              {createInvitation.isPending ? "Enviando…" : "Enviar convite"}
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="shrink-0 flex-row justify-end gap-2 px-7">
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CarteiraEquipeView({ canManage }: { canManage: boolean }) {
  const { data: team } = useConsultants();
  const [inviteOpen, setInviteOpen] = useState(false);
  const { data: invitations } = useInvitations("CONSULTANT", { enabled: canManage });

  const managers = team?.managers ?? [];
  const pending = (invitations ?? []).filter(
    (i) => i.status !== "ACCEPTED" && i.status !== "REVOKED",
  );

  return (
    <>
      <TeamAuditHome
        canManage={canManage}
        onInvite={() => setInviteOpen(true)}
        pendingInvitesSlot={
          canManage && pending.length > 0 ? (
            <PendingInvitationsSection invitations={pending} />
          ) : null
        }
      />
      {canManage ? (
        <InviteTeamDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          managers={managers}
        />
      ) : null}
    </>
  );
}

/**
 * Convites de equipe ainda não aceitos. Existe porque, sem essa lista, convite
 * repetido para o mesmo e-mail se acumula invisível — e o agrônomo só descobre
 * quando o convidado esbarra em "já existe uma conta com este e-mail".
 */
function PendingInvitationsSection({ invitations }: { invitations: InvitationRow[] }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-[#2B2723]">
          Convites pendentes{" "}
          <span className="font-semibold text-[#8A857D]">({invitations.length})</span>
        </h2>
        <p className="text-sm text-[#8A857D]">
          · enviados por e-mail, aguardando o convidado criar a senha
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {invitations.map((invitation) => (
          <li key={invitation.id}>
            <PendingInvitationCard invitation={invitation} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PendingInvitationCard({ invitation }: { invitation: InvitationRow }) {
  const resend = useResendInvitation();
  const remove = useDeleteInvitation();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const papel =
    invitation.kind === "FARM_TEAM"
      ? invitation.access_level === "FARM_MANAGER"
        ? "Gerente"
        : "Operador"
      : invitation.access_level === "CONSULTANT"
        ? "Consultor"
        : "Gestor";
  const expirado =
    invitation.status === "EXPIRED" || new Date(invitation.expires_at) < new Date();
  const link = `${typeof window === "undefined" ? "" : window.location.origin}${routes.convite(invitation.token)}`;

  const copiar = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reenviar = async () => {
    try {
      const res = await resend.mutateAsync(invitation.id);
      toast.success(
        res.email_sent
          ? `Convite reenviado para ${invitation.email}.`
          : "Convite renovado. Sem e-mail cadastrado — envie o link.",
      );
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível reenviar o convite."));
    }
  };

  const excluir = async () => {
    try {
      await remove.mutateAsync(invitation.id);
      toast.success("Convite excluído.");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível excluir o convite."));
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#EDE7DC] bg-white px-[22px] py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F3EEDD] text-[#7A6B3F]">
          <MailWarning className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[15px] font-bold text-[#2B2723]">
              {invitation.email ?? "Sem e-mail (só link)"}
            </p>
            <span className="rounded-full bg-[#E4EEE7] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#1E6B4A]">
              {papel}
            </span>
            {expirado ? (
              <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-danger-strong">
                Expirado
              </span>
            ) : null}
          </div>
          <p className="text-[13px] text-[#8A857D]">
            {expirado
              ? "O link não funciona mais. Reenvie para renovar por mais 14 dias."
              : `Válido até ${formatarData(invitation.expires_at)}`}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={copiar} className="gap-1.5">
          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
          Link
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={reenviar}
          disabled={resend.isPending || !invitation.email}
          className="gap-1.5"
          title={invitation.email ? undefined : "Convite sem e-mail cadastrado"}
        >
          <Send className="size-4" />
          {resend.isPending ? "Enviando…" : "Reenviar"}
        </Button>
        {confirming ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="destructive"
              size="sm"
              onClick={excluir}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Excluindo…" : "Confirmar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(true)}
            className="gap-1.5 text-danger-strong hover:bg-danger-soft"
          >
            <Trash2 className="size-4" />
            Excluir
          </Button>
        )}
      </div>
    </div>
  );
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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
  const [role, setRole] = useState<TeamInviteLevel>("MANAGER");
  const [vinculo, setVinculo] = useState<"direto" | string>("direto");
  const [link, setLink] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [producerIds, setProducerIds] = useState<string[]>([]);
  const [producerFilter, setProducerFilter] = useState("");
  // Só produtores ativos — o backend já filtra desativados.
  const { data: shareableProducers } = useShareableProducers(open);

  const emailValid = /.+@.+\..+/.test(email.trim());
  const effectiveRole: TeamInviteLevel = isStaffManager ? "CONSULTANT" : role;

  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setEmail("");
      setRole(isStaffManager ? "CONSULTANT" : "MANAGER");
      setVinculo("direto");
      setLink(null);
      setSentTo(null);
      setProducerIds([]);
      setProducerFilter("");
    }
  }

  const submit = async () => {
    try {
      const payload: Parameters<typeof createInvitation.mutateAsync>[0] = {
        email: email.trim(),
        kind: "CONSULTANT",
        access_level: effectiveRole,
        farm_ids: [],
        producer_ids: producerIds,
      };
      if (effectiveRole === "CONSULTANT" && !isStaffManager) {
        payload.manager_user_id = vinculo === "direto" ? null : vinculo;
      }
      const res = await createInvitation.mutateAsync(payload);
      const full = `${window.location.origin}${routes.convite(res.token)}`;
      setLink(full);
      if (res.email_sent) {
        setSentTo(payload.email ?? null);
        toast.success(
          producerIds.length > 0
            ? `Convite enviado para ${payload.email} com ${producerIds.length} produtor(es).`
            : `Convite enviado para ${payload.email}.`,
        );
      } else {
        toast.success("Convite criado. Envie o link ao membro.");
      }
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
        <DialogHeader className="shrink-0 px-7 pt-7">
          <DialogTitle className="text-[21px] font-extrabold">Convidar para a equipe</DialogTitle>
          <DialogDescription>
            Escolha o papel, os produtores que ele vai acompanhar e envie o convite por
            e-mail.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-7 py-5">
          {link ? (
            <div className="flex flex-col gap-3">
              {sentTo ? (
                <div className="rounded-2xl border border-[#D9E6DD] bg-[#F2F7F3] px-4 py-3 text-sm text-[#2B2723]">
                  Convite enviado para <strong>{sentTo}</strong>. O link vale por 14 dias.
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <Label>{sentTo ? "Ou envie o link direto" : "Link de convite"}</Label>
                <div className="flex gap-2">
                  <Input readOnly value={link} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={copy} title="Copiar">
                    {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                  </Button>
                </div>
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
                    selected={effectiveRole === "CONSULTANT"}
                    title="Consultor"
                    description="Acompanha produtores compartilhados, cria recomendações e registra aplicações."
                    onClick={() => setRole("CONSULTANT")}
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

              {effectiveRole === "CONSULTANT" && !isStaffManager ? (
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

              <ProducerPicker
                producers={shareableProducers ?? []}
                selected={producerIds}
                onToggle={(id) =>
                  setProducerIds((prev) =>
                    prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
                  )
                }
                onToggleAll={(ids) => setProducerIds(ids)}
                filter={producerFilter}
                onFilterChange={setProducerFilter}
              />
            </>
          )}
        </div>
        {!link ? (
          <DialogFooter className="shrink-0 flex-row justify-end gap-2 px-7">
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
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Escolha de produtores dentro do convite. Antes só dava para compartilhar
 * depois do aceite, na tela do membro — quem convidava precisava lembrar de
 * voltar lá, e o convidado entrava sem enxergar nada.
 */
function ProducerPicker({
  producers,
  selected,
  onToggle,
  onToggleAll,
  filter,
  onFilterChange,
}: {
  producers: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  filter: string;
  onFilterChange: (value: string) => void;
}) {
  if (producers.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Produtores</Label>
        <p className="rounded-xl border border-[#EDE7DC] bg-[#FAF8F4] px-4 py-3 text-sm text-[#8A857D]">
          Nenhum produtor ativo para compartilhar. Você pode liberar depois, na tela do
          membro.
        </p>
      </div>
    );
  }

  const termo = filter.trim().toLowerCase();
  const visiveis = termo
    ? producers.filter((p) => p.name.toLowerCase().includes(termo))
    : producers;
  const todosMarcados = selected.length === producers.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>
          Produtores{" "}
          <span className="font-normal text-[#8A857D]">
            ({selected.length} de {producers.length})
          </span>
        </Label>
        <button
          type="button"
          className="text-[13px] font-semibold text-[#1E6B4A] hover:underline"
          onClick={() => onToggleAll(todosMarcados ? [] : producers.map((p) => p.id))}
        >
          {todosMarcados ? "Limpar" : "Selecionar todos"}
        </button>
      </div>
      {producers.length > 6 ? (
        <Input
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Buscar produtor…"
          className="rounded-xl"
        />
      ) : null}
      <ul className="max-h-[184px] overflow-y-auto rounded-xl border border-[#EDE7DC] bg-white">
        {visiveis.length === 0 ? (
          <li className="px-4 py-3 text-sm text-[#8A857D]">Nenhum produtor com esse nome.</li>
        ) : (
          visiveis.map((p) => {
            const marcado = selected.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onToggle(p.id)}
                  aria-pressed={marcado}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[#F7F5F1]"
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-md border transition",
                      marcado
                        ? "border-[#1E6B4A] bg-[#1E6B4A] text-white"
                        : "border-[#D5CFC5] bg-white",
                    )}
                  >
                    {marcado ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className="truncate text-sm text-[#2B2723]">{p.name}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
      <p className="text-[13px] text-[#8A857D]">
        Liberados assim que o convite for aceito. Dá para ajustar depois na tela do membro.
      </p>
    </div>
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
