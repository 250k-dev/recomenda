import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const DOSE_UNITS = ["L", "KG", "G", "ML", "DOSE"] as const;
export type DoseUnit = (typeof DOSE_UNITS)[number];

interface DoseUnitSelectProps {
  value: string;
  onChange: (value: DoseUnit) => void;
  className?: string;
  disabled?: boolean;
}

export function DoseUnitSelect({ value, onChange, className, disabled }: DoseUnitSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as DoseUnit)}
      disabled={disabled}
      options={DOSE_UNITS.map((unit) => ({
        value: unit,
        label: unit,
      }))}
      className={cn("min-w-[96px] w-[96px] shrink-0", className)}
    />
  );
}
