import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const DOSE_UNITS = ["L", "KG", "G", "ML", "DOSE", "T_HA", "BAG", "SACA"] as const;
export type DoseUnit = (typeof DOSE_UNITS)[number];

/** Rótulo curto exibido no seletor de unidade. */
const DOSE_UNIT_SHORT_LABELS: Record<DoseUnit, string> = {
  L: "L",
  KG: "kg",
  G: "g",
  ML: "mL",
  DOSE: "Dose",
  T_HA: "t/ha",
  BAG: "bag",
  SACA: "sacos",
};

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
        label: DOSE_UNIT_SHORT_LABELS[unit],
      }))}
      className={cn("min-w-[96px] w-[96px] shrink-0", className)}
    />
  );
}
