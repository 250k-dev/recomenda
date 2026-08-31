"use client";

import { Check } from "lucide-react";
import {
  FARM_STAFF_GRANT_DEFS,
  type FarmStaffGrantKey,
} from "@recomenda/domain/auth/farm-staff-grants";
import type { AccessLevel } from "@recomenda/api/auth-types";
import { cn } from "@recomenda/utils";

export function FarmStaffGrantsPalette({
  level,
  selected,
  onChange,
}: {
  level: Extract<AccessLevel, "FARM_MANAGER" | "FARM_OPERATOR">;
  selected: FarmStaffGrantKey[];
  onChange: (next: FarmStaffGrantKey[]) => void;
}) {
  const defs = FARM_STAFF_GRANT_DEFS.filter(
    (d) => !d.managerOnly || level === "FARM_MANAGER",
  );

  const toggle = (key: FarmStaffGrantKey) => {
    onChange(
      selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key],
    );
  };

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-[#2B2723]">Permissões</p>
        <p className="text-[12px] text-[#8A857D]">
          {selected.length} de {defs.length}
        </p>
      </div>
      <p className="text-[13px] leading-snug text-[#8A857D]">
        Marque o que esta pessoa pode fazer neste produtor.
      </p>
      <ul className="overflow-hidden rounded-xl border border-[#EDE7DC] bg-white">
        {defs.map((d, i) => {
          const on = selected.includes(d.key);
          return (
            <li key={d.key} className={cn(i > 0 && "border-t border-[#F1EEE8]")}>
              <button
                type="button"
                onClick={() => toggle(d.key)}
                aria-pressed={on}
                className={cn(
                  "flex w-full min-w-0 items-start gap-3 px-3 py-2.5 text-left transition",
                  on ? "bg-[#F2F7F3]" : "bg-white hover:bg-[#F7F5F1]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-4 shrink-0 place-items-center rounded-[5px] border",
                    on
                      ? "border-[#1E6B4A] bg-[#1E6B4A] text-white"
                      : "border-[#D5CFC5] bg-white",
                  )}
                >
                  {on ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-snug text-[#2B2723]">
                    {d.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-[#8A857D]">
                    {d.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
