import { StatusBadge, type StatusTone } from "@/components/domain/status-badge";
import type { AdminProducerAccountStatus } from "@recomenda/api";

export const PRODUCER_ACCOUNT_STATUS_LABEL: Record<
  AdminProducerAccountStatus,
  string
> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  CONVITE_ENVIADO: "Convite enviado",
  CONVITE_EXPIRADO: "Convite expirado",
};

const STATUS_TONE: Record<AdminProducerAccountStatus, StatusTone> = {
  ATIVO: "success",
  INATIVO: "neutral",
  CONVITE_ENVIADO: "warning",
  CONVITE_EXPIRADO: "danger",
};

export function ProducerAccountStatusBadge({
  status,
}: {
  status: AdminProducerAccountStatus;
}) {
  return (
    <StatusBadge tone={STATUS_TONE[status]}>
      {PRODUCER_ACCOUNT_STATUS_LABEL[status]}
    </StatusBadge>
  );
}
