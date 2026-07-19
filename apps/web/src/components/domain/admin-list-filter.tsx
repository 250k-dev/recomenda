"use client";

import { Input } from "@recomenda/ui/input";

type AdminListFilterProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function AdminListFilter({ value, onChange, placeholder = "Filtrar listagem..." }: AdminListFilterProps) {
  return (
    <div className="mb-4">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="max-w-md"
        aria-label={placeholder}
      />
    </div>
  );
}
