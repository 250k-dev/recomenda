"use client";

import { useState } from "react";
import { Input } from "../primitives/input";

/**
 * Texto pt-BR (`114.811,11`) → número canônico do JS (`114811.11`).
 * Ponto = milhar só quando o grupo tem 3 dígitos (`1.020`) ou há vírgula
 * decimal. `1020.0` / `1020.00` (1–2 casas, canônico JS) NÃO pode perder o
 * ponto — senão 1020 vira 10200 no salvar.
 */
export function brToCanonical(raw: string): string {
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (!cleaned) return "";
  const neg = cleaned.startsWith("-");
  let body = cleaned.replace(/-/g, "");
  if (body.includes(",")) {
    body = body.replace(/\./g, "").replace(",", ".");
    body = body.replace(/,/g, "");
  } else if (body.includes(".")) {
    const parts = body.split(".");
    const last = parts[parts.length - 1] ?? "";
    const canonicalDecimal = parts.length === 2 && last.length >= 1 && last.length <= 2;
    if (!canonicalDecimal) {
      body = parts.join("");
    }
  }
  if (body === "" || body === ".") return "";
  return neg ? `-${body}` : body;
}

/**
 * Número canônico (`114811.11`) → texto pt-BR (`114.811,11`), preservando as casas
 * decimais como estão (sem arredondar) — serve tanto pra preço (2 casas) quanto pro
 * dólar (3-4 casas). Com `decimals`, completa zeros (`1020` + 2 → `1.020,00`).
 * `grouping: false` não usa ponto de milhar (`1020,00`) — quantidade de estoque
 * não pode virar `1.020` e ser “corrigida” para `10.200`.
 */
export function canonicalToBr(
  canonical: string,
  decimals?: number,
  grouping = true,
): string {
  if (!canonical) return "";
  const neg = canonical.startsWith("-");
  let s = neg ? canonical.slice(1) : canonical;
  if (decimals != null) {
    const n = Number(canonical);
    if (Number.isFinite(n)) {
      s = Math.abs(n).toFixed(decimals);
    }
  }
  const [intPart, decPart] = s.split(".");
  const grouped = grouping
    ? (intPart || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    : (intPart || "0");
  const out = decPart != null ? `${grouped},${decPart}` : grouped;
  return neg ? `-${out}` : out;
}

type MoneyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange" | "inputMode"
> & {
  /** Valor canônico (número JS em string, ex.: "114811.11" ou ""). */
  value: string;
  /** Recebe o valor já canônico pronto para `Number(...)`. */
  onValueChange: (canonical: string) => void;
  /** Casas no blur/exibição (ex.: 2 → `1020` aparece `1.020,00`). */
  decimals?: number;
  /** Ponto de milhar. Desligado em quantidade de estoque (`1020,00`, não `1.020`). */
  grouping?: boolean;
};

/**
 * Input monetário em formato brasileiro. Aceita digitar `114.811,11` (ponto de
 * milhar + vírgula decimal), mas entrega/guarda o valor canônico (`114811.11`).
 * Usa `type="text"` porque `type="number"` do navegador não aceita separador de
 * milhar nem vírgula decimal.
 */
export function MoneyInput({
  value,
  onValueChange,
  decimals,
  grouping = true,
  ...props
}: MoneyInputProps) {
  const toBr = (canonical: string) => canonicalToBr(canonical, decimals, grouping);
  const [text, setText] = useState(() => toBr(value));
  const [focused, setFocused] = useState(false);

  // Ressincroniza o texto quando o valor externo muda e o campo NÃO está em foco
  // (troca de item, recálculo pelo dólar, etc.) — ajuste em render, sem efeito.
  // Enquanto digita (em foco), não mexe no que o usuário está escrevendo.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (!focused) setText(toBr(value));
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        onValueChange(brToCanonical(raw));
      }}
      onBlur={(e) => {
        setFocused(false);
        setText(toBr(brToCanonical(text)));
        props.onBlur?.(e);
      }}
    />
  );
}
