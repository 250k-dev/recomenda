import { Suspense } from "react";
import { FieldObservationsView } from "@/components/domain/field-observations-view";

/**
 * Histórico de ocorrências do Lico — rota SEM link na UI (08/10): o usuário valida em
 * produção (único número do Lico) acessando pelo endereço. Aceita ?produtor=<id>.
 */
export default function LicoOcorrenciasPage() {
  return (
    <Suspense fallback={null}>
      <FieldObservationsView />
    </Suspense>
  );
}
