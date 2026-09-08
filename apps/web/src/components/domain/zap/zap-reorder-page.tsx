"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Logo } from "@recomenda/ui/assets/logo";
import { Button } from "@recomenda/ui/primitives/button";
import { ZapLinkError } from "./zap-link-error";
import { formatZapExpiry, type ZapLoadResult, type ZapReorderDto } from "./zap-types";

export function ZapReorderPage({
  token,
  result,
}: {
  token: string;
  result: ZapLoadResult<ZapReorderDto>;
}) {
  if (!result.ok) {
    return <ZapLinkError status={result.status} message={result.message} />;
  }
  if (result.data.typ !== "season_reorder") {
    return <ZapLinkError status={404} message="Este link não reordena etapas." />;
  }
  return <ZapReorderForm token={token} initial={result.data} />;
}

function ZapReorderForm({ token, initial }: { token: string; initial: ZapReorderDto }) {
  const [stages, setStages] = useState(initial.stages);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= stages.length) return;
    setStages((rows) => {
      const copy = [...rows];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/zap/seasons/${encodeURIComponent(initial.seasonId)}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          recommendationIds: stages.map((s) => s.id),
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: { message?: string };
      } | null;
      if (!response.ok || !json?.ok) {
        setError(json?.error?.message ?? "Não deu para gravar a ordem.");
        return;
      }
      setDone(true);
    } catch {
      setError("Não deu para gravar a ordem.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="grid size-12 place-items-center rounded-xl bg-primary shadow-(--brand-shadow)">
          <Logo className="size-6 fill-white" />
        </span>
        <h1 className="font-display text-xl font-bold text-text-strong">Ordem gravada</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          As etapas de <strong className="text-text-strong">{initial.label}</strong> já estão na nova
          ordem. Pode voltar no WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary shadow-(--brand-shadow)">
            <Logo className="size-5 fill-white" />
          </span>
          <div>
            <p className="font-display text-base font-bold text-text-strong">Reordenar etapas</p>
            <p className="text-xs text-muted-foreground">
              {initial.label} · {formatZapExpiry(initial.expiresAt)}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-xl flex-1 gap-4 p-4 pb-10">
        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-danger-soft px-3 py-2 text-sm text-danger-strong">
            {error}
          </p>
        ) : null}

        {stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Essa safra ainda não tem etapas para reordenar.</p>
        ) : (
          <ol className="grid gap-2">
            {stages.map((stage, index) => (
              <li
                key={stage.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
              >
                <span className="w-6 shrink-0 text-xs font-medium text-muted-foreground">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-strong">
                  {stage.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Subir ${stage.name}`}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2"
                  disabled={index === stages.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Descer ${stage.name}`}
                >
                  <ArrowDown className="size-4" />
                </Button>
              </li>
            ))}
          </ol>
        )}

        <Button type="button" disabled={busy || stages.length < 2} onClick={() => void submit()}>
          {busy ? "Gravando…" : "Salvar ordem"}
        </Button>
      </main>
    </div>
  );
}
