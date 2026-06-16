import { AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/domain/status-badge";

export function ProducerAttentionBadge({
  lateCount,
  todayCount,
}: {
  lateCount: number;
  todayCount: number;
}) {
  if (lateCount > 0) {
    return (
      <StatusBadge tone="danger" icon={<AlertTriangle className="size-3.5" />}>
        {lateCount} atrasada{lateCount === 1 ? "" : "s"}
      </StatusBadge>
    );
  }

  if (todayCount > 0) {
    return (
      <StatusBadge tone="warning">
        {todayCount} hoje
      </StatusBadge>
    );
  }

  return <StatusBadge tone="neutral">Em dia</StatusBadge>;
}
