"use client";

import { Download, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ReportsExportPanel() {
  const handleExport = () => {
    toast.info("Exportação em PDF em breve.");
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4.5 shadow-sm">
      <div className="mb-2 flex items-center gap-2.5">
        <Download className="size-4 text-primary-strong" />
        <b className="text-[0.95rem] text-text-strong">Exportar relatório</b>
      </div>
      <p className="mb-3 text-[13px] text-muted-foreground">
        Gere um PDF comparativo para enviar ao produtor.
      </p>
      <Button
        type="button"
        variant="outline"
        className="h-[42px] w-full rounded-[11px] text-sm font-semibold"
        onClick={handleExport}
      >
        <FileDown className="size-4" />
        Exportar PDF
      </Button>
    </section>
  );
}
