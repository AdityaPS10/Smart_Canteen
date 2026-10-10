"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
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
    <Link href={`/orders/${active.id}`}>
      <Card className="flex items-center justify-between gap-3 border-primary/50 p-4 transition-colors hover:bg-muted/50">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">
            Your current order{active.token_number ? ` · Token ${active.token_number}` : ""}
          </span>
          <StatusBadge status={active.status} className="w-fit" />
        </div>
        <ChevronRight className="text-muted-foreground" />
      </Card>
    </Link>
  );
}
