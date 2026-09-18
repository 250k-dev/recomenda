"use client";

import { ArrowDownAZ, ArrowUpZA } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { cn } from "@recomenda/utils";

export type PlotNameSortDir = "asc" | "desc" | null;

export function nextPlotNameSortDir(dir: PlotNameSortDir): PlotNameSortDir {
  if (dir === null) return "asc";
  if (dir === "asc") return "desc";
  return null;
}

/** Quebra "TH 01/02" em ['th ', 1, '/', 2] para 03 ficar entre 01/02 e 04. */
function plotNameTokens(name: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const source = name.trim();
  const chunk = /(\d+)|(\D+)/g;
  let match: RegExpExecArray | null;
  while ((match = chunk.exec(source))) {
    if (match[1]) {
      tokens.push(Number.parseInt(match[1], 10));
      continue;
    }
    tokens.push(match[2].toLocaleLowerCase("pt-BR"));
  }
  return tokens;
}

function comparePlotNameTokens(
  a: Array<string | number>,
  b: Array<string | number>,
): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    if (typeof left === "number" && typeof right === "number") {
      if (left !== right) return left - right;
      continue;
    }
    if (typeof left === "number") return -1;
    if (typeof right === "number") return 1;
    const cmp = left.localeCompare(right, "pt-BR", { sensitivity: "base" });
    if (cmp !== 0) return cmp;
  }
  return 0;
}

export function comparePlotName(
  a: string,
  b: string,
  dir: Exclude<PlotNameSortDir, null>,
): number {
  const cmp = comparePlotNameTokens(plotNameTokens(a), plotNameTokens(b));
  return dir === "asc" ? cmp : -cmp;
}

/** Cabeçalho clicável da coluna Talhão (A–Z / Z–A). */
export function PlotNameSortHeader({
  dir,
  onCycle,
}: {
  dir: PlotNameSortDir;
  onCycle: () => void;
}) {
  const Icon = dir === "desc" ? ArrowUpZA : ArrowDownAZ;
  return (
    <button
      type="button"
      onClick={onCycle}
      className={cn(
        "-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-left uppercase tracking-[inherit] transition-colors hover:bg-hover/40 hover:text-text-strong",
        dir ? "text-text-strong" : "text-muted-foreground",
      )}
      aria-label={
        dir === "asc"
          ? "Ordenar talhões de Z a A"
          : "Ordenar talhões de A a Z"
      }
      title={
        dir === "asc"
          ? "A → Z — clique para Z → A"
          : dir === "desc"
            ? "Z → A — clique para a ordem original"
            : "Ordenar A → Z"
      }
    >
      Talhão
      <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
    </button>
  );
}

/** Atalho compacto para mobile (tabela some). */
export function PlotNameSortIconButton({
  dir,
  onCycle,
}: {
  dir: PlotNameSortDir;
  onCycle: () => void;
}) {
  const Icon = dir === "desc" ? ArrowUpZA : ArrowDownAZ;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-10 w-10 shrink-0"
      onClick={onCycle}
      aria-label={
        dir === "asc"
          ? "Ordenar talhões de Z a A"
          : "Ordenar talhões de A a Z"
      }
      title={
        dir === "asc"
          ? "A → Z — clique para Z → A"
          : dir === "desc"
            ? "Z → A — clique para a ordem original"
            : "Ordenar A → Z"
      }
    >
      <Icon className="size-4" />
    </Button>
  );
}
