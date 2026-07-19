import { ReactNode } from "react";
import { cn } from "@recomenda/utils";
import { BreadcrumbBack, type BreadcrumbItem } from "./breadcrumb-back";

/**
 * Contextual sub-toolbar for detail pages: breadcrumb on the left, actions on
 * the right. Surface bar that sits at the top of the page content.
 */
export function DetailToolbar({
  items,
  actions,
  className,
}: {
  items: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 shadow-sm",
        className,
      )}
    >
      <div className="min-w-0 [&_nav]:mb-0">
        <BreadcrumbBack items={items} />
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      ) : null}
    </div>
  );
}
