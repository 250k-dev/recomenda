"use client";

import { useState } from "react";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@recomenda/ui/primitives/native-select";
import { TIMING_TRIGGER_TYPES } from "@/components/domain/timing/timing-stages-editor";
import type { ZapCatalogItem } from "./zap-types";

export type ZapDraftProduct = {
  key: string;
  productId: string;
  productName: string;
  dose: string;
  doseUnit: string;
};

export type ZapDraftStage = {
  key: string;
  name: string;
  triggerType: string;
  targetDay: string;
  notes: string;
  products: ZapDraftProduct[];
};

export function newZapDraftStage(name = ""): ZapDraftStage {
  return {
    key: crypto.randomUUID(),
    name,
    triggerType: "POST_PLANTING",
    targetDay: "0",
    notes: "",
    products: [],
  };
}

export function ZapTimingStagesForm({
  stages,
  onChange,
  token,
  producerId,
}: {
  stages: ZapDraftStage[];
  onChange: (stages: ZapDraftStage[]) => void;
  token: string;
  producerId: string;
}) {
  function patchStage(key: string, patch: Partial<ZapDraftStage>) {
    onChange(stages.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  return (
    <div className="grid gap-3">
      {stages.map((stage, index) => (
        <section
          key={stage.key}
          className="grid gap-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Etapa {index + 1}
            </p>
            {stages.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-destructive hover:text-destructive"
                onClick={() => onChange(stages.filter((s) => s.key !== stage.key))}
              >
                Remover
              </Button>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`stage-name-${stage.key}`}>Nome</Label>
            <Input
              id={`stage-name-${stage.key}`}
              value={stage.name}
              onChange={(e) => patchStage(stage.key, { name: e.target.value })}
              placeholder="Ex: Dessecação"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`stage-trigger-${stage.key}`}>Fase</Label>
            <NativeSelect
              id={`stage-trigger-${stage.key}`}
              className="w-full"
              value={stage.triggerType}
              onChange={(e) => patchStage(stage.key, { triggerType: e.target.value })}
            >
              {TIMING_TRIGGER_TYPES.map((t) => (
                <NativeSelectOption key={t.value} value={t.value}>
                  {t.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`stage-day-${stage.key}`}>Dias a partir do marco</Label>
            <Input
              id={`stage-day-${stage.key}`}
              inputMode="numeric"
              value={stage.targetDay}
              onChange={(e) => patchStage(stage.key, { targetDay: e.target.value })}
            />
          </div>
          <ZapStageProducts
            token={token}
            producerId={producerId}
            products={stage.products}
            onChange={(products) => patchStage(stage.key, { products })}
          />
        </section>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...stages, newZapDraftStage()])}
      >
        Adicionar etapa
      </Button>
    </div>
  );
}

function ZapStageProducts({
  token,
  producerId,
  products,
  onChange,
}: {
  token: string;
  producerId: string;
  products: ZapDraftProduct[];
  onChange: (products: ZapDraftProduct[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ZapCatalogItem[]>([]);
  const [busy, setBusy] = useState(false);

  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 2 || !producerId) {
      setHits([]);
      return;
    }
    setBusy(true);
    try {
      const params = new URLSearchParams({
        token,
        q: value,
        producerId,
      });
      const response = await fetch(`/api/v1/zap/catalog?${params.toString()}`);
      if (!response.ok) return;
      const json = (await response.json()) as { items: ZapCatalogItem[] };
      setHits(json.items ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 border-t border-border pt-3">
      <Label>Produtos da etapa</Label>
      {products.map((product) => (
        <div key={product.key} className="grid grid-cols-[1fr_5.5rem_auto] gap-2">
          <p className="truncate self-center text-sm font-medium">{product.productName}</p>
          <Input
            inputMode="decimal"
            value={product.dose}
            onChange={(e) =>
              onChange(
                products.map((p) =>
                  p.key === product.key ? { ...p, dose: e.target.value } : p,
                ),
              )
            }
            aria-label={`Dose de ${product.productName}`}
            placeholder={product.doseUnit}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => onChange(products.filter((p) => p.key !== product.key))}
          >
            Tirar
          </Button>
        </div>
      ))}
      <Input
        value={query}
        onChange={(e) => void search(e.target.value)}
        placeholder={busy ? "Buscando…" : "Buscar produto (2 letras)"}
      />
      {hits.length > 0 ? (
        <ul className="grid max-h-40 gap-1 overflow-auto">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-hover"
                onClick={() => {
                  onChange([
                    ...products,
                    {
                      key: crypto.randomUUID(),
                      productId: hit.id,
                      productName: hit.name,
                      dose: "",
                      doseUnit: hit.doseUnit,
                    },
                  ]);
                  setHits([]);
                  setQuery("");
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
    </div>
  );
}
