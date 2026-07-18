"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@recomenda/utils";

export type DeletePermanentIconButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "variant" | "size" | "children"
> & {
  title?: string;
};

export function DeletePermanentIconButton({
  title = "Excluir permanentemente",
  className,
  disabled,
  ...props
}: DeletePermanentIconButtonProps) {
  return (
    <Button
      variant="destructive"
      size="icon"
      className={cn("h-8 w-8 shrink-0", className)}
      title={title}
      disabled={disabled}
      {...props}
    >
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}
