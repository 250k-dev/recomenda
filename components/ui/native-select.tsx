import * as React from "react";

import { cn } from "@/lib/utils";

const baseSelectClasses =
  "flex h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-background px-3 pr-9 py-1 text-sm text-foreground shadow-xs outline-none transition-all placeholder:text-muted-foreground hover:border-ring/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

const chevronStyle: React.CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 8l5 5 5-5'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.625rem center",
  backgroundSize: "1rem 1rem",
};

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  function NativeSelect({ className, style, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        data-slot="native-select"
        className={cn(baseSelectClasses, className)}
        style={{ ...chevronStyle, ...style }}
        {...props}
      >
        {children}
      </select>
    );
  },
);
