"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Texto pt-BR (`114.811,11`) → número canônico do JS (`114811.11`), que é o que o
 * resto do app usa em `Number(...)`. Ponto = milhar, vírgula = decimal.
 */
export function brToCanonical(raw: string): string {
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (!cleaned) return "";
  const neg = cleaned.startsWith("-");
  let body = cleaned
    .replace(/-/g, "")
    .replace(/\./g, "") // remove separadores de milhar
    .replace(",", "."); // vírgula decimal → ponto
  body = body.replace(/,/g, ""); // vírgulas extras (digitação errada)
  if (body === "" || body === ".") return "";
  return neg ? `-${body}` : body;
}

/**
 * Número canônico (`114811.11`) → texto pt-BR (`114.811,11`), preservando as casas
 * decimais como estão (sem arredondar) — serve tanto pra preço (2 casas) quanto pro
 * dólar (3-4 casas).
 */
export function canonicalToBr(canonical: string): string {
  if (!canonical) return "";
  const neg = canonical.startsWith("-");
  const s = neg ? canonical.slice(1) : canonical;
  const [intPart, decPart] = s.split(".");
  const grouped = (intPart || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
};

/**
 * Input monetário em formato brasileiro. Aceita digitar `114.811,11` (ponto de
 * milhar + vírgula decimal), mas entrega/guarda o valor canônico (`114811.11`).
 * Usa `type="text"` porque `type="number"` do navegador não aceita separador de
 * milhar nem vírgula decimal.
 */
export function MoneyInput({ value, onValueChange, ...props }: MoneyInputProps) {
  const [text, setText] = useState(() => canonicalToBr(value));
  const [focused, setFocused] = useState(false);

  // Ressincroniza o texto quando o valor externo muda e o campo NÃO está em foco
  // (troca de item, recálculo pelo dólar, etc.) — ajuste em render, sem efeito.
  // Enquanto digita (em foco), não mexe no que o usuário está escrevendo.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (!focused) setText(canonicalToBr(value));
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
        setText(canonicalToBr(brToCanonical(text)));
        props.onBlur?.(e);
      }}
    />
  );
}
