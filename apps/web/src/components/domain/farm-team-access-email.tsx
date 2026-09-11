"use client";

import { Mail, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@recomenda/ui/primitives/button";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { useResendFarmTeamAccess } from "@recomenda/api-hooks";
import type { FarmTeamMember } from "@recomenda/api/farm-team";
import { StatusBadge } from "@/components/domain/status-badge";

function formatSentAt(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export function FarmTeamAccessEmail({ member }: { member: FarmTeamMember }) {
  const resend = useResendFarmTeamAccess();
  const status = member.access_email?.status ?? "never";
  const neverSent = status === "never";
  const failed = status === "failed";
  const skipped = status === "skipped";
  const sentAt = formatSentAt(member.access_email?.sent_at ?? null);

  async function send() {
    try {
      const res = await resend.mutateAsync(member.id);
      toast.success(
        res.email_sent
          ? `E-mail de acesso enviado para ${member.email}.`
          : "Não foi possível enfileirar o e-mail. Tente de novo.",
      );
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível enviar o e-mail."));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {neverSent ? (
        <StatusBadge tone="warning" icon={<MailWarning className="size-3.5" />}>
          {member.is_temporary ? "Cadastrado sem e-mail" : "E-mail não enviado"}
        </StatusBadge>
      ) : null}
      {failed ? (
        <StatusBadge tone="danger" icon={<MailWarning className="size-3.5" />}>
          Envio falhou
        </StatusBadge>
      ) : null}
      {skipped ? (
        <StatusBadge tone="neutral" icon={<Mail className="size-3.5" />}>
          Bloqueado neste ambiente
        </StatusBadge>
      ) : null}
      {status === "sent" ? (
        <span className="text-[12px] text-muted-foreground">
          E-mail enviado{sentAt ? ` · ${sentAt}` : ""}
        </span>
      ) : null}
      {neverSent || failed ? (
        <p className="basis-full text-[12px] leading-snug text-muted-foreground">
          {member.is_temporary && neverSent
            ? "A conta foi criada na hora. Sem o e-mail, a pessoa não recebe o link para criar a senha."
            : "Reenvie o acesso: a pessoa cria a senha pelo link."}
        </p>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant={neverSent || failed ? "outline" : "ghost"}
        className="gap-1.5"
        disabled={resend.isPending || !member.email}
        onClick={send}
      >
        <Mail className="size-3.5" aria-hidden />
        {resend.isPending
          ? "Enviando…"
          : neverSent
            ? "Enviar e-mail"
            : "Reenviar e-mail"}
      </Button>
    </div>
  );
}
