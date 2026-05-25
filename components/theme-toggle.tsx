"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Variant = "switch" | "compact";

interface ThemeToggleProps {
  variant?: Variant;
  className?: string;
}

const OPTIONS: Array<{ value: "light" | "dark" | "system"; label: string; Icon: typeof Sun }> = [
  { value: "light", label: "Modo claro", Icon: Sun },
  { value: "dark", label: "Modo escuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
];

export function ThemeToggle({ variant = "switch", className }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // next-themes resolve o tema no client; evita flash entre SSR e hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (variant === "compact") {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    const Icon = resolvedTheme === "dark" ? Sun : Moon;
    return (
      <button
        type="button"
        aria-label={next === "dark" ? "Ativar modo escuro" : "Ativar modo claro"}
        onClick={() => setTheme(next)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 focus-visible:outline-none",
          className,
        )}
      >
        {mounted ? <Icon className="size-4 transition-transform duration-300" /> : <span className="size-4" />}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Selecionar tema"
      className={cn(
        "inline-flex items-center rounded-full border border-sidebar-border bg-sidebar p-1 shadow-xs",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mounted ? theme === value : value === "system";
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full text-sidebar-foreground/70 transition-all duration-200",
              "hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40",
              active && "bg-primary text-primary-foreground shadow-sm",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
