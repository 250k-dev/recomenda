"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@recomenda/ui/primitives/label";
import { SearchableSelect } from "@recomenda/ui/forms/select";
import {
  BRAZIL_STATES,
  cn,
  fetchCitiesByState,
} from "@recomenda/utils";

type FarmLocationFieldsProps = {
  stateUf: string;
  city: string;
  onStateChange: (uf: string) => void;
  onCityChange: (city: string) => void;
  /** Prefixo dos ids dos campos (acessibilidade / labels). */
  idPrefix?: string;
  label?: string;
  className?: string;
};

/**
 * Estado + Cidade (IBGE) — mesmo padrão do onboarding de produtor.
 * A localização gravada no backend continua sendo `"Cidade, UF"`.
 */
export function FarmLocationFields({
  stateUf,
  city,
  onStateChange,
  onCityChange,
  idPrefix = "farm",
  label = "Localização (opcional)",
  className,
}: FarmLocationFieldsProps) {
  const citiesQuery = useQuery({
    queryKey: ["ibge-cities", stateUf],
    queryFn: () => fetchCitiesByState(stateUf),
    enabled: Boolean(stateUf),
    staleTime: 1000 * 60 * 60 * 24,
  });

  const stateOptions = useMemo(
    () =>
      BRAZIL_STATES.map((state) => ({
        value: state.uf,
        label: state.name,
        keywords: `${state.name} ${state.uf}`,
      })),
    [],
  );

  const cityOptions = useMemo(
    () =>
      (citiesQuery.data ?? []).map((cityName) => ({
        value: cityName,
        label: cityName,
      })),
    [citiesQuery.data],
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <Label className="text-sm font-medium text-foreground">{label}</Label>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label
            htmlFor={`${idPrefix}-state`}
            className="text-xs font-semibold text-muted-foreground"
          >
            Estado
          </Label>
          <SearchableSelect
            id={`${idPrefix}-state`}
            value={stateUf}
            onValueChange={(nextUf) => {
              onStateChange(nextUf);
              onCityChange("");
            }}
            options={stateOptions}
            placeholder="Selecione…"
            searchPlaceholder="Buscar estado…"
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor={`${idPrefix}-city`}
            className="text-xs font-semibold text-muted-foreground"
          >
            Cidade
          </Label>
          <SearchableSelect
            id={`${idPrefix}-city`}
            value={city}
            onValueChange={onCityChange}
            options={cityOptions}
            placeholder={
              !stateUf
                ? "Selecione o estado"
                : citiesQuery.isError
                  ? "Erro ao carregar"
                  : "Selecione…"
            }
            searchPlaceholder="Buscar cidade…"
            disabled={!stateUf || citiesQuery.isLoading || citiesQuery.isError}
            loading={Boolean(stateUf) && citiesQuery.isLoading}
            loadingMessage="Carregando cidades…"
            emptyMessage="Nenhuma cidade encontrada."
          />
        </div>
      </div>
      {citiesQuery.isError ? (
        <p className="text-xs text-destructive">
          Não foi possível carregar as cidades. Verifique a conexão e selecione
          o estado novamente.
        </p>
      ) : null}
    </div>
  );
}
