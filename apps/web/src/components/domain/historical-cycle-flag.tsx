"use client";

import { History } from "lucide-react";
import { Badge } from "@recomenda/ui/primitives/badge";

/** Flag visível em criação/edição de arquivo de safra antiga. */
export function HistoricalCycleFlag({ className }: { className?: string }) {
  return (
    <Badge variant="warning" className={className}>
      <History className="size-3" aria-hidden />
      Histórico
    </Badge>
  );
}
