"use client";

import { Select } from "@recomenda/ui/forms/select";
import { cn, DOSE_UNIT_SHORT_LABELS, GLOBAL_DOSE_UNITS, type GlobalDoseUnit } from "@recomenda/utils";

interface DoseUnitSelectProps {
  value: string;
  onChange: (value: GlobalDoseUnit) => void;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "default";
}

export function DoseUnitSelect({
  value,
  onChange,
  className,
  disabled,
  size,
}: DoseUnitSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as GlobalDoseUnit)}
      disabled={disabled}
      size={size}
      options={GLOBAL_DOSE_UNITS.map((unit) => ({
        value: unit,
        label: DOSE_UNIT_SHORT_LABELS[unit],
      }))}
      className={cn("min-w-[5.5rem] w-[5.5rem] shrink-0", className)}
    />
  );
}
