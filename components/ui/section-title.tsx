import * as React from "react";

import { cn } from "@/lib/utils";

interface SectionTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
  as?: "h2" | "h3";
}

export function SectionTitle({
  title,
  description,
  action,
  as: Heading = "h2",
  className,
  ...rest
}: SectionTitleProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4",
        className,
      )}
      {...rest}
    >
      <div className="min-w-0">
        <Heading className="text-base font-semibold text-foreground tracking-tight">
          {title}
        </Heading>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
