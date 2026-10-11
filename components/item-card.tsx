import * as React from "react";
import { Zap } from "lucide-react";
import { cn, formatPaise } from "@/lib/utils";

/** One menu item: name, price, "ready to pick up" tag, and a control on the right (stepper or quantity). */
export function ItemCard({
  name,
  pricePaise,
  readyMade,
  selected,
  children,
  className,
}: {
  name: string;
  pricePaise: number;
  readyMade?: boolean;
  selected?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors",
        selected && "border-foreground/60 ring-1 ring-foreground/20",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-base font-semibold">{name}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium tabular-nums">{formatPaise(pricePaise)}</span>
          {readyMade && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Zap className="size-3.5" aria-hidden /> Ready to pick up
            </span>
          )}
        </span>
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

/** Loading placeholder with the same footprint as ItemCard. */
export function ItemCardSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-32 animate-pulse rounded bg-accent" />
        <div className="h-4 w-16 animate-pulse rounded bg-accent" />
      </div>
      <div className="h-11 w-24 animate-pulse rounded-full bg-accent" />
    </div>
  );
}
