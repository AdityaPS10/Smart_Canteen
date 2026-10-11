"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { StatusChip } from "@/components/status-chip";
import { TokenChip } from "@/components/token-chip";
import { fetchJson } from "@/hooks/use-live-data";
import type { OrderStatus } from "@/lib/types";

interface Active {
  order: { id: string; status: OrderStatus; token_number: number | null } | null;
}

/** Home: if the student has an active order, link to it. */
export function ActiveOrderLink() {
  const [active, setActive] = useState<Active["order"]>(null);

  useEffect(() => {
    fetchJson<Active>("/api/orders/active")
      .then((d) => setActive(d.order))
      .catch(() => setActive(null));
  }, []);

  if (!active) return null;
  return (
    <Link
      href={`/orders/${active.id}`}
      className="group flex items-center gap-4 rounded-xl border-2 border-foreground/80 bg-card p-4 shadow-sm transition-colors hover:bg-accent"
    >
      {active.token_number ? (
        <TokenChip token={active.token_number} size="md" tone={active.status === "READY" ? "success" : "solid"} />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="font-semibold">Your current order</span>
        <StatusChip status={active.status} />
      </div>
      <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
