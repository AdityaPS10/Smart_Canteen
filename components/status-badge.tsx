import { Badge } from "@/components/ui/badge";
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

const VARIANT: Record<OrderStatus, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  PENDING_PAYMENT: "outline",
  PAYMENT_FAILED: "destructive",
  PAID: "secondary",
  PREPARING: "warning",
  READY: "success",
  GIVEN: "default",
  EXPIRED: "destructive",
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <Badge variant={VARIANT[status]} className={className}>
      {LABEL[status]}
    </Badge>
  );
}
