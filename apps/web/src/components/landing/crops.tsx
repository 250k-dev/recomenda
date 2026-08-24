import { Logo250K } from "@/assets/logo-250K";
import { Container, Pill } from "./primitives";
import { Sprout, Wheat } from "./icons";

export function Crops() {
  return (
    <div className="border-y border-line bg-surface/70">
      <Container className="flex flex-col items-center gap-6 py-9 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-3.5">
          <Logo250K width={30} height={41} aria-hidden />
          <p className="max-w-xs text-sm leading-snug text-muted">
            Uma solução <span className="font-semibold text-ink">250k</span> para
            quem vive do campo — do escritório ao talhão.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/40">
            Culturas
          </span>
          <Pill tone="brand">
            <Sprout width={15} height={15} /> Soja
          </Pill>
          <Pill tone="clay">
            <Wheat width={15} height={15} /> Milho
          </Pill>
          <Pill tone="neutral">Preços em R$ e US$</Pill>
        </div>
      </Container>
    </div>
  );
}
