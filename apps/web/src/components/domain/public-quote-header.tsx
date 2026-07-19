import { Lock } from "lucide-react";
import { Logo } from "@recomenda/ui/assets/logo";

/** Header for the public lojista quote pages — brand + security seal. */
export function PublicQuoteHeader() {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3.5 sm:px-7">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-lg bg-primary shadow-(--brand-shadow)">
          <Logo className="size-5 fill-white" />
        </span>
        <span className="font-display text-lg font-bold tracking-[-0.02em] text-text-strong">
          Recomenda
        </span>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-success-border bg-success-soft px-3 py-1 text-xs font-semibold text-success-strong">
        <Lock className="size-3.5" /> Cotação privada e segura
      </span>
    </div>
  );
}
