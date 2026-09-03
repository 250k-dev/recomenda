"use client";

import * as React from "react";
import { BaseSelect } from "./searchable-select";
import { cn } from "@recomenda/utils";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = Omit<
  React.ComponentProps<typeof BaseSelect>,
  "options" | "onValueChange" | "searchable"
> & {
  options?: SelectOption[];
  onValueChange?: (value: string) => void;
  /** Compatível com react-hook-form `register()`. */
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
};

/**
 * Select padrão — mesmo popover customizado do SearchableSelect (sem campo de busca).
 */
const Select = React.forwardRef<HTMLInputElement, SelectProps>(function Select(
  {
    className,
    size = "default",
    placeholder,
    options = [],
    onValueChange,
    onChange,
    onBlur,
    value = "",
    name,
    id,
    disabled,
    filterLabel,
    selectedLabel,
    ...props
  },
  ref,
) {
  const hiddenRef = React.useRef<HTMLInputElement>(null);

  React.useImperativeHandle(ref, () => hiddenRef.current as HTMLInputElement);

  const handleValueChange = (nextValue: string) => {
    if (hiddenRef.current) {
      hiddenRef.current.value = nextValue;
    }
    onValueChange?.(nextValue);
    onChange?.({
      target: { name, value: nextValue },
      currentTarget: { name, value: nextValue },
    } as React.ChangeEvent<HTMLSelectElement>);
  };

  return (
    <>
      <BaseSelect
        id={id}
        name={name}
        value={value}
        onValueChange={handleValueChange}
        onBlur={onBlur}
        placeholder={placeholder}
        filterLabel={filterLabel}
        options={options}
        selectedLabel={selectedLabel}
        searchable={false}
        disabled={disabled}
        size={size}
        className={cn("w-full", className)}
        {...props}
      />
      <input
        ref={hiddenRef}
        type="hidden"
        name={name}
        value={value}
        readOnly
        tabIndex={-1}
        aria-hidden
      />
    </>
  );
});

export { Select };
export {
  SearchableSelect,
  SelectPortalContainer,
  type SearchableSelectOption,
} from "./searchable-select";
