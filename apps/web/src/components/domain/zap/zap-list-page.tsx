"use client";

import { useMemo, useState } from "react";
import { Logo } from "@recomenda/ui/assets/logo";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@recomenda/ui/primitives/native-select";
import { ZapLinkError } from "./zap-link-error";
import type {
  ZapCatalogItem,
  ZapListDto,
  ZapLoadResult,
} from "./zap-types";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function ZapListPage({
  token,
  result,
}: {
  token: string;
  result: ZapLoadResult<ZapListDto>;
}) {
  if (!result.ok) {
    return <ZapLinkError status={result.status} message={result.message} />;
  }
  if (result.data.typ !== "list_edit") {
    return (
      <ZapLinkError
        status={404}
        message="Este link não abre uma lista de compras."
      />
    );
  }
  return <ZapListReady token={token} initial={result.data} />;
}

function ZapListReady({ token, initial }: { token: string; initial: ZapListDto }) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [hits, setHits] = useState<ZapCatalogItem[]>([]);
  const [picked, setPicked] = useState<ZapCatalogItem | null>(null);
  const [dose, setDose] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of data.list.items) {
      map.set(item.category, item.categoryLabel || item.category);
    }
    return [...map.entries()];
  }, [data.list.items]);

  const visible = data.list.items.filter((item) => {
    const q = query.trim().toLowerCase();
    if (q && !item.productName.toLowerCase().includes(q)) return false;
    if (category !== "ALL" && item.category !== category) return false;
    return true;
  });

  async function mutate(
    path: string,
    method: string,
    body?: Record<string, unknown>,
  ) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await response.json().catch(() => null)) as
        | ZapListDto
        | { error?: { message?: string } }
        | null;
      if (!response.ok) {
        setError(
          (json && "error" in json ? json.error?.message : null) ??
            "Não deu para gravar agora. Tente de novo.",
        );
        return;
      }
      setData(json as ZapListDto);
      setPicked(null);
      setDose("");
      setHits([]);
      setAddQuery("");
    } catch {
      setError("Não deu para gravar agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function searchCatalog(value: string) {
    setAddQuery(value);
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    const response = await fetch(
      `/api/v1/zap/catalog?token=${encodeURIComponent(token)}&q=${encodeURIComponent(value)}`,
    );
    if (!response.ok) return;
    const json = (await response.json()) as { items: ZapCatalogItem[] };
    setHits(json.items ?? []);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary shadow-(--brand-shadow)">
            <Logo className="size-5 fill-white" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold tracking-[-0.02em] text-text-strong">
              {data.list.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.list.cropLabel ?? data.list.crop}
              {data.list.totalHectares
                ? ` · ${data.list.totalHectares} ha`
                : ""}
              {data.canWrite ? " · pode editar" : " · só leitura"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4 pb-10">
        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-danger-soft px-3 py-2 text-sm text-danger-strong">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="zap-list-search">Buscar produto</Label>
            <Input
              id="zap-list-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome do produto"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="zap-list-category">Categoria</Label>
            <NativeSelect
              id="zap-list-category"
              className="w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <NativeSelectOption value="ALL">Todas</NativeSelectOption>
              {categories.map(([id, label]) => (
                <NativeSelectOption key={id} value={id}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>

        <ul className="grid gap-3">
          {visible.length === 0 ? (
            <li className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              Nenhum item com esse filtro.
            </li>
          ) : (
            visible.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <p className="font-semibold text-text-strong">{item.productName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.categoryLabel}
                  {item.quantity
                    ? ` · ${item.quantity} ${item.doseUnit}`
                    : ""}
                  {data.showPrices && item.totalBrl
                    ? ` · ${money.format(item.totalBrl)}`
                    : ""}
                </p>
                {data.canWrite ? (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div className="grid min-w-28 flex-1 gap-1">
                      <Label htmlFor={`dose-${item.id}`}>Dose/ha</Label>
                      <Input
                        id={`dose-${item.id}`}
                        inputMode="decimal"
                        value={editing[item.id] ?? String(item.dosePerHectare)}
                        onChange={(e) =>
                          setEditing((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        mutate(
                          `/api/v1/zap/lists/${data.list.id}/items/${item.id}`,
                          "PATCH",
                          {
                            token,
                            dosePerHectare: Number(
                              (editing[item.id] ?? item.dosePerHectare)
                                .toString()
                                .replace(",", "."),
                            ),
                          },
                        )
                      }
                    >
                      Salvar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busy}
                      onClick={() =>
                        mutate(
                          `/api/v1/zap/lists/${data.list.id}/items/${item.id}?token=${encodeURIComponent(token)}`,
                          "DELETE",
                        )
                      }
                    >
                      Remover
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-text-strong">
                    {item.dosePerHectare} {item.doseUnit}/ha
                  </p>
                )}
              </li>
            ))
          )}
        </ul>

        {data.canWrite ? (
          <section className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="font-display text-base font-semibold text-text-strong">
              Adicionar produto
            </h2>
            <div className="grid gap-1.5">
              <Label htmlFor="zap-add-search">Catálogo</Label>
              <Input
                id="zap-add-search"
                value={addQuery}
                onChange={(e) => void searchCatalog(e.target.value)}
                placeholder="Digite ao menos 2 letras"
              />
            </div>
            {hits.length > 0 ? (
              <ul className="grid max-h-48 gap-1 overflow-auto">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-hover"
                      onClick={() => {
                        setPicked(hit);
                        setHits([]);
                        setAddQuery(hit.name);
                      }}
                    >
                      <span className="font-medium">{hit.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {hit.categoryLabel} · {hit.doseUnit}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {picked ? (
              <div className="grid gap-3">
                <p className="text-sm text-text-strong">
                  Selecionado: <strong>{picked.name}</strong>
                </p>
                <div className="grid gap-1.5">
                  <Label htmlFor="zap-add-dose">Dose por hectare</Label>
                  <Input
                    id="zap-add-dose"
                    inputMode="decimal"
                    value={dose}
                    onChange={(e) => setDose(e.target.value)}
                    placeholder={`Em ${picked.doseUnit}`}
                  />
                </div>
                <Button
                  type="button"
                  disabled={busy || !dose}
                  onClick={() =>
                    mutate(`/api/v1/zap/lists/${data.list.id}/items`, "POST", {
                      token,
                      localProductId: picked.id,
                      dosePerHectare: Number(dose.replace(",", ".")),
                      doseUnit: picked.doseUnit,
                    })
                  }
                >
                  Adicionar na lista
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
