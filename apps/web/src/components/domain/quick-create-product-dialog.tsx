"use client";

import { useState } from "react";
import { Loader2, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { Select } from "@recomenda/ui/forms/select";
import { useCreateLocalProduct } from "@recomenda/api-hooks";
import type { Product } from "@recomenda/api";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { PRODUCT_CATEGORY_LABELS } from "@recomenda/utils";
import {
  formulationEquivalenceGroup,
  type FormulationKey,
} from "@recomenda/domain/recommendations/formulation-mix-order";
import { DoseUnitSelect } from "@/components/domain/dose-unit-select";
import {
  categoryHasFormulation,
  defaultDoseUnitForCategory,
  fixedDoseUnitForCategory,
  FORMULATION_SELECT_OPTIONS,
} from "@/components/domain/product-form-options";

export type QuickCreatedProduct = {
  id: string;
  name: string;
  dose_unit: string;
  equivalence_group: string | null;
};

interface QuickCreateProductDialogProps {
  open: boolean;
  /** Texto digitado na busca — vira o nome sugerido. */
  initialName: string;
  category: string;
  /** Unidade sugerida; sem ela, vale o padrão da categoria. */
  defaultUnit?: string;
  onCancel: () => void;
  onCreated: (product: QuickCreatedProduct) => void;
}

/**
 * Cadastro de produto que não existe no catálogo, direto de onde ele foi
 * digitado (lista de compra, cronograma). Pede unidade e formulação na hora —
 * antes o produto nascia só com o nome e a unidade "Dose".
 */
export function QuickCreateProductDialog({
  open,
  initialName,
  category,
  defaultUnit,
  onCancel,
  onCreated,
}: QuickCreateProductDialogProps) {
  const createLocal = useCreateLocalProduct();
  const saving = createLocal.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !saving ? onCancel() : undefined)}>
      <DialogContent className="sm:max-w-md">
        {/* O conteúdo só monta com o diálogo aberto: o estado nasce das props
            a cada abertura, sem efeito de reset. */}
        <QuickCreateProductForm
          key={`${category}|${initialName}`}
          initialName={initialName}
          category={category}
          defaultUnit={defaultUnit}
          createLocal={createLocal}
          onCancel={onCancel}
          onCreated={onCreated}
        />
      </DialogContent>
    </Dialog>
  );
}

function QuickCreateProductForm({
  initialName,
  category,
  defaultUnit,
  createLocal,
  onCancel,
  onCreated,
}: Omit<QuickCreateProductDialogProps, "open"> & {
  createLocal: ReturnType<typeof useCreateLocalProduct>;
}) {
  const fixedUnit = fixedDoseUnitForCategory(category);
  const showFormulation = categoryHasFormulation(category);
  const [name, setName] = useState(initialName.trim());
  const [unit, setUnit] = useState<string>(
    fixedUnit ?? defaultUnit ?? defaultDoseUnitForCategory(category),
  );
  const [formulation, setFormulation] = useState("");
  const saving = createLocal.isPending;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const equivalenceGroup =
      showFormulation && formulation
        ? formulationEquivalenceGroup(formulation as FormulationKey)
        : null;
    try {
      const created: Product = await createLocal.mutateAsync({
        name: trimmed,
        category: category || "OTHER",
        dose_unit: fixedUnit ?? unit,
        equivalence_group: equivalenceGroup,
      });
      toast.success("Produto cadastrado no seu catálogo.");
      onCreated({
        id: created.id,
        name: created.name ?? trimmed,
        dose_unit: created.dose_unit ?? fixedUnit ?? unit,
        equivalence_group: created.equivalence_group ?? equivalenceGroup,
      });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível cadastrar o produto."));
    }
  };

  const categoryLabel =
    PRODUCT_CATEGORY_LABELS[category as keyof typeof PRODUCT_CATEGORY_LABELS] ??
    category;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <PackagePlus className="h-5 w-5 text-primary" />
          Novo produto
        </DialogTitle>
        <DialogDescription>
          Não achamos esse produto no catálogo. Confira os dados e ele entra
          nos seus produtos customizados{categoryLabel ? ` (${categoryLabel})` : ""}.
        </DialogDescription>
      </DialogHeader>

      <form
        className="space-y-4 px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="quick-product-name">Nome</Label>
          <Input
            id="quick-product-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Unidade de medida</Label>
            <DoseUnitSelect
              value={fixedUnit ?? unit}
              onChange={setUnit}
              disabled={Boolean(fixedUnit)}
              className="w-full"
            />
          </div>
          {showFormulation ? (
            <div className="space-y-1.5">
              <Label>Formulação</Label>
              <Select
                value={formulation}
                onValueChange={setFormulation}
                placeholder="Selecionar…"
                filterLabel="Formulação"
                options={FORMULATION_SELECT_OPTIONS}
                className="w-full"
              />
            </div>
          ) : null}
        </div>
        <button type="submit" hidden aria-hidden />
      </form>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={saving || !name.trim()}
          className="gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Cadastrar produto
        </Button>
      </DialogFooter>
    </>
  );
}
