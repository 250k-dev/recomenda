/** Conic-gradient completion ring used in the lojista fill-prices header. */
export function CompletionRing({
  value,
  size = 50,
}: {
  /** 0–100 */
  value: number;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const inner = size - 12;
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--primary) ${pct}%, var(--surface-2) 0)`,
      }}
    >
      <div
        className="grid place-items-center rounded-full bg-surface text-xs font-bold tabular-nums text-text-strong"
        style={{ width: inner, height: inner }}
      >
        {pct}%
      </div>
    </div>
  );
}
