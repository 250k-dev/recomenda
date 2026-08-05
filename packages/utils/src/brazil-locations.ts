export type BrazilState = {
  uf: string;
  name: string;
};

export const BRAZIL_STATES: BrazilState[] = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];

export function formatFarmLocation(city: string, uf: string): string {
  return `${city}, ${uf}`;
}

/** Separa `"Cidade, UF"` (formato do onboarding) em partes editáveis. */
export function parseFarmLocation(location: string | null | undefined): {
  city: string;
  uf: string;
} {
  const raw = (location ?? "").trim();
  if (!raw) return { city: "", uf: "" };
  const match = raw.match(/^(.*),\s*([A-Za-z]{2})$/);
  if (match) {
    const uf = match[2].toUpperCase();
    if (BRAZIL_STATES.some((state) => state.uf === uf)) {
      return { city: match[1].trim(), uf };
    }
  }
  // Texto livre legado: mantém como cidade para o usuário reescolher o estado.
  return { city: raw, uf: "" };
}

/** Monta `location` opcional no formato canônico, ou `undefined` se incompleto. */
export function optionalFarmLocation(
  city: string,
  uf: string,
): string | undefined {
  const trimmedCity = city.trim();
  if (!trimmedCity || !uf) return undefined;
  return formatFarmLocation(trimmedCity, uf);
}

export async function fetchCitiesByState(uf: string): Promise<string[]> {
  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios?orderBy=nome`,
  );
  if (!response.ok) {
    throw new Error("Não foi possível carregar as cidades.");
  }
  const data = (await response.json()) as Array<{ nome: string }>;
  return data.map((city) => city.nome);
}
