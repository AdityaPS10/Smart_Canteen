import { cn, formatPaise } from "@/lib/utils";

export interface BillLine {
  key: string;
  name: string;
  unitPaise: number;
  quantity: number;
}

/** Itemised bill: item, qty, amount, and the total (always the server's numbers). */
export function Bill({ lines, totalPaise, className }: { lines: BillLine[]; totalPaise: number; className?: string }) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex justify-between border-b pb-2 text-sm font-medium text-muted-foreground">
        <span>Item</span>
        <span>Amount</span>
      </div>
      <ul className="divide-y">
        {lines.map((l) => (
          <li key={l.key} className="flex items-start justify-between gap-4 py-3">
            <div className="flex min-w-0 flex-col">
              <span className="font-medium">{l.name}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {l.quantity} × {formatPaise(l.unitPaise)}
              </span>
            </div>
            <span className="shrink-0 font-medium tabular-nums">{formatPaise(l.unitPaise * l.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t-2 border-foreground/80 pt-3">
        <span className="text-base font-semibold">Total</span>
        <span className="text-2xl font-semibold tabular-nums">{formatPaise(totalPaise)}</span>
      </div>
    </div>
  );
}
