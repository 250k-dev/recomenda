"use client";

import { useState } from "react";
import { Check, Copy, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { updateProducer } from "@recomenda/api/producers";
import { useInviteProducerAccess } from "@recomenda/api-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@recomenda/api-hooks";
import { routes } from "@recomenda/config";

type InviteTarget = {
  producerId: string;
  name: string;
  email: string;
};

export function InviteProducerAccessDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: InviteTarget | null;
}) {
  const queryClient = useQueryClient();
  const inviteAccess = useInviteProducerAccess();
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);

  // Reset ao abrir (padrão React — sync no render).
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open && target) {
      setEmail(target.email?.trim() ?? "");
      setLink(null);
      setSentTo(null);
      setCopied(false);
    }
  }

  const emailValid = /.+@.+\..+/.test(email.trim());
  const pending = inviteAccess.isPending;

  const submit = async () => {
    if (!target || !emailValid) return;
    const normalized = email.trim().toLowerCase();
    try {
      const current = target.email?.trim().toLowerCase() ?? "";
      if (normalized !== current) {
        await updateProducer(target.producerId, { email: normalized });
        await queryClient.invalidateQueries({ queryKey: queryKeys.producers });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.producer(target.producerId),
        });
      }
      const res = await inviteAccess.mutateAsync(target.producerId);
      const full = `${window.location.origin}${routes.convite(res.token)}`;
      setLink(full);
      if (res.email_sent) {
        setSentTo(normalized);
        toast.success(
          res.resent
            ? `Convite reenviado para ${normalized}.`
            : `Convite enviado para ${normalized}.`,
        );
      } else {
        setSentTo(null);
        toast.success("Convite criado. Copie o link abaixo.");
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível enviar o convite."));
    }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copiado.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] rounded-[20px] p-0">
        <DialogHeader className="shrink-0 px-7 pt-7">
          <DialogTitle className="flex items-center gap-2 text-[21px] font-extrabold">
            <Mail className="size-5" />
            Convite de acesso
          </DialogTitle>
          <DialogDescription>
            {link
              ? "Envie o e-mail ou copie o link para o produtor definir a senha."
              : target
                ? `Envie o link para ${target.name} definir a senha e entrar no painel web.`
                : "Envie o link para o produtor definir a senha."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-7 py-5">
          {link ? (
            <div className="flex flex-col gap-3">
              {sentTo ? (
                <div className="rounded-2xl border border-[#D9E6DD] bg-[#F2F7F3] px-4 py-3 text-sm text-[#2B2723]">
                  Convite enviado para <strong>{sentTo}</strong>. Você também
                  pode copiar o link abaixo.
                </div>
              ) : (
                <div className="rounded-2xl border border-[#EDE7DC] bg-[#FBF8F1] px-4 py-3 text-sm text-[#2B2723]">
                  Convite criado. Envie o link abaixo para o produtor.
                </div>
              )}
              <div className="flex gap-2">
                <Input value={link} readOnly className="rounded-xl font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copy()}
                  className="shrink-0 gap-2"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="invite-access-email">E-mail</Label>
              <Input
                id="invite-access-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="produtor@email.com"
                className="rounded-xl"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
              {!email.trim() ? (
                <p className="text-xs text-muted-foreground">
                  Se ainda não houver e-mail cadastrado, preencha aqui antes de enviar.
                </p>
              ) : null}
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0 flex-row justify-end gap-2 px-7 pb-7">
          {link ? (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void submit()}
                disabled={pending || !emailValid}
                className="gap-2"
              >
                <Send className="size-4" />
                {pending ? "Enviando…" : "Enviar convite"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
