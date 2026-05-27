import { NativeSelect } from "./native-select";
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
    <NativeSelect
      value={value}
      onChange={(e) => onChange(e.target.value as DoseUnit)}
      className={cn("w-[72px] shrink-0", className)}
      disabled={disabled}
    >
      {DOSE_UNITS.map((u) => (
        <option key={u} value={u}>
          {u.toLowerCase()}
        </option>
      ))}
    </NativeSelect>
  );
}
