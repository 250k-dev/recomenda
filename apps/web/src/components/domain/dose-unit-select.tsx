"use client";

import { Select } from "@recomenda/ui/select";
import { cn, DOSE_UNIT_SHORT_LABELS, GLOBAL_DOSE_UNITS, type GlobalDoseUnit } from "@recomenda/utils";

interface DoseUnitSelectProps {
  value: string;
  onChange: (value: GlobalDoseUnit) => void;
  className?: string;
  disabled?: boolean;
}

export function DoseUnitSelect({ value, onChange, className, disabled }: DoseUnitSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as GlobalDoseUnit)}
      disabled={disabled}
      options={GLOBAL_DOSE_UNITS.map((unit) => ({
        value: unit,
        label: DOSE_UNIT_SHORT_LABELS[unit],
      }))}
      className={cn("min-w-[96px] w-[96px] shrink-0", className)}
    />
  );
}
