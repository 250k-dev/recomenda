import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AdminProducerAccountStatus } from "@/lib/api/client";

export const PRODUCER_ACCOUNT_STATUS_LABEL: Record<AdminProducerAccountStatus, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  CONVITE_ENVIADO: "Convite enviado",
  CONVITE_EXPIRADO: "Convite expirado",
};

export function ProducerAccountStatusBadge({ status }: { status: AdminProducerAccountStatus }) {
  const label = PRODUCER_ACCOUNT_STATUS_LABEL[status];
  const className = cn(
    "font-normal tabular-nums",
    status === "ATIVO" && "border-emerald-200 bg-emerald-50 text-emerald-900",
    status === "INATIVO" && "border-border bg-muted text-muted-foreground",
    status === "CONVITE_ENVIADO" && "border-sky-200 bg-sky-50 text-sky-900",
    status === "CONVITE_EXPIRADO" && "border-amber-200 bg-amber-50 text-amber-950",
  );
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
