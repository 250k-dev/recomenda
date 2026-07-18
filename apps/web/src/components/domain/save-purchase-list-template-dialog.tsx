"use client";

import { useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreatePurchaseListTemplate } from "@/lib/api/hooks";
import { apiErrorMessage } from "@/lib/api-error";
import { cn } from "@recomenda/utils";
import { FieldError } from "@/components/domain/season/_shared";
import { listItemToPayload, type ListItem } from "@/lib/purchase-list/list-item";

/**
 * Botão + diálogo "Salvar como template": grava os produtos atuais como modelo
 * reutilizável (sem talhões nem produtor). Fica disponível tanto na criação
 * (wizard) quanto na lista já salva — a lista muda com o tempo e o agrônomo
 * precisa conseguir reaproveitar as alterações.
 */
export function SavePurchaseListTemplateButton({
  items,
  crop,
  suggestedName,
  size = "default",
  className,
}: {
  items: ListItem[];
  crop: string;
  /** Nome pré-preenchido no diálogo (ex.: o nome da lista). */
  suggestedName?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const createTemplate = useCreatePurchaseListTemplate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    setError(null);
    setName((suggestedName ?? "").trim());
    setOpen(true);
  };

  const save = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Dê um nome para o template.");
      return;
    }
    try {
      await createTemplate.mutateAsync({
        crop,
        name: name.trim(),
        plots: [],
        items: items.map((it) => listItemToPayload(it, crop)),
      });
      toast.success("Template salvo.");
      setOpen(false);
    } catch (e) {
      setError(apiErrorMessage(e, "Não foi possível salvar o template."));
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={openDialog}
        disabled={items.length === 0}
        className={cn("gap-1.5", className)}
      >
        <BookmarkPlus className="h-4 w-4" />
        Salvar como template
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar como template</DialogTitle>
            <DialogDescription>
              Guarda os produtos desta lista como um modelo reutilizável (sem talhões nem
              produtor). Você pode importá-lo em outras safras.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="save-template-name">Nome do template</Label>
            <Input
              id="save-template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Soja — dessecação + plantio"
            />
            {error ? <FieldError message={error} /> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void save()}
              disabled={createTemplate.isPending}
              className="gap-2"
            >
              {createTemplate.isPending ? "Salvando…" : "Salvar template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
