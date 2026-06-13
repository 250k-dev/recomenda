"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { ptBR } from "react-day-picker/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  dateToLocalYmd,
  formatTimingPreviewDate,
  localYmdToDate,
  maskBrazilianDateInput,
  parseBrazilianDate,
} from "@/lib/timing/window-days";

type BrazilianDateInputProps = {
  value: string;
  onChange?: (ymd: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

export function BrazilianDateInput({
  value,
  onChange,
  readOnly = false,
  placeholder = "DD/MM/AAAA",
  className,
  "aria-label": ariaLabel,
}: BrazilianDateInputProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => (value ? formatTimingPreviewDate(value) : ""));

  useEffect(() => {
    setText(value ? formatTimingPreviewDate(value) : "");
  }, [value]);

  const selectedDate =
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? localYmdToDate(value) : undefined;

  const commitText = (nextText: string) => {
    const parsed = parseBrazilianDate(nextText);
    if (parsed) {
      onChange?.(parsed);
      setText(formatTimingPreviewDate(parsed));
      return;
    }
    setText(value ? formatTimingPreviewDate(value) : "");
  };

  if (readOnly) {
    return (
      <Input
        value={value ? formatTimingPreviewDate(value) : ""}
        readOnly
        tabIndex={-1}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn("bg-muted/40 text-muted-foreground", className)}
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <Input
          value={text}
          inputMode="numeric"
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={cn("pr-10", className)}
          onChange={(event) => setText(maskBrazilianDateInput(event.target.value))}
          onBlur={() => commitText(text)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitText(text);
            }
          }}
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Abrir calendário"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
      </div>

      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selectedDate}
          defaultMonth={selectedDate ?? new Date()}
          onSelect={(date) => {
            if (!date) return;
            const nextValue = dateToLocalYmd(date);
            onChange?.(nextValue);
            setText(formatTimingPreviewDate(nextValue));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
