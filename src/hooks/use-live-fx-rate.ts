import * as React from "react";

/**
 * Busca a cotação corrente do dólar comercial (USD → BRL) na AwesomeAPI,
 * um serviço gratuito brasileiro. Usada como valor padrão da cotação na
 * lista de compra, mantendo a possibilidade de o usuário editar à mão.
 */
const FX_ENDPOINT = "https://economia.awesomeapi.com.br/last/USD-BRL";

export function useLiveFxRate() {
  const [rate, setRate] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    fetch(FX_ENDPOINT)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((json: { USDBRL?: { bid?: string } }) => {
        const bid = Number(json?.USDBRL?.bid);
        if (active && Number.isFinite(bid) && bid > 0) setRate(bid);
      })
      .catch(() => {
        // Falha de rede/serviço: mantém o valor existente da cotação.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { rate, loading };
}
