import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

const LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Waiting for payment",
  PAYMENT_FAILED: "Payment failed",
  PAID: "Paid",
  PREPARING: "Preparing",
  READY: "Ready",
  GIVEN: "Given",
  EXPIRED: "Expired",
};

// success = Ready / Given, danger = payment failed / expired; in-progress states stay neutral.
const TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "border-border bg-card text-foreground",
  PAYMENT_FAILED: "border-transparent bg-danger text-danger-foreground",
  PAID: "border-transparent bg-secondary text-secondary-foreground",
  PREPARING: "border-transparent bg-primary text-primary-foreground",
  READY: "border-transparent bg-success text-success-foreground",
  GIVEN: "border-border bg-muted text-muted-foreground",
  EXPIRED: "border-transparent bg-danger text-danger-foreground",
};

export function statusLabel(status: OrderStatus) {
  return LABEL[status];
}

export function StatusChip({
  status,
  size = "md",
  className,
}: {
  status: OrderStatus;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "lg" ? "px-3.5 py-1 text-base" : "px-2.5 py-0.5 text-sm",
        TONE[status],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />
      {LABEL[status]}
    </span>
  );
}
