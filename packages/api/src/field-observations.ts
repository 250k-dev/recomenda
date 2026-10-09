import { api } from "./http/axios";

/** Tipo do achado na foto — o mesmo `tipo` que a visão do Lico devolve. */
export type FieldObservationKind = "praga" | "doenca" | "daninha" | "deficiencia";

export type FieldObservationStatus = "aberta" | "vista" | "resolvida";

export interface FieldObservationCandidate {
  nome_comum: string;
  nome_cientifico: string | null;
  confianca: "alta" | "media" | "baixa";
  evidencias: string;
}

/** Ocorrência de campo: foto analisada pelo Lico no WhatsApp. */
export interface FieldObservation {
  id: string;
  tipo: FieldObservationKind;
  cultura: string | null;
  resumo: string;
  diagnostico: {
    candidatos?: FieldObservationCandidate[];
    sintomas?: string;
    severidade?: string | null;
    estadio?: string | null;
    pedir_mais_fotos?: string | null;
  };
  legenda: string | null;
  status: FieldObservationStatus;
  producer_user_id: string | null;
  author_user_id: string;
  author_name: string | null;
  tem_foto: boolean;
  /** "Fazenda Lagoa · Talhão 3 · Soja" — informado no Zap depois da foto. */
  local_nome: string | null;
  plot_id: string | null;
  season_id: string | null;
  /** Relatório do Lico (só para agrônomo, gestor e consultor). */
  sugestoes: FieldObservationReport | null;
  created_at: string;
}

/** Opções REGISTRADAS para o alvo da foto na cultura do talhão — estoque do produtor primeiro. */
export interface FieldObservationReport {
  gerado_em: string;
  cultura: string | null;
  alvo: string;
  total_registrados: number;
  sem_registro: boolean;
  no_estoque: number;
  aviso_ogm: string | null;
  opcoes: Array<{
    marca: string;
    registro: string;
    ativo: string;
    classe: string;
    biologico: boolean;
    dose_bula: string[];
    registrado_para: string;
    no_estoque: boolean;
    estoque: { quantidade: number; unidade: string | null } | null;
  }>;
}

export async function getFieldObservations(params?: { status?: FieldObservationStatus; producer_id?: string }) {
  const { data } = await api.get<{ data: FieldObservation[] }>("/field-observations", { params });
  return data.data;
}

export async function updateFieldObservationStatus(id: string, status: FieldObservationStatus) {
  const { data } = await api.patch<{ id: string; status: FieldObservationStatus }>(
    `/field-observations/${encodeURIComponent(id)}`,
    { status },
  );
  return data;
}

/**
 * URL da foto para `<img src>`. Passa pelo proxy `/api/v1`, que injeta o token do
 * cookie — a foto nunca fica pública, o servidor confere a posse a cada pedido.
 */
export function fieldObservationPhotoUrl(id: string): string {
  return `/api/v1/field-observations/${encodeURIComponent(id)}/photo`;
}
