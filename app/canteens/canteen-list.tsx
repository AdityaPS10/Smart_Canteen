"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { fetchJson } from "@/hooks/use-live-data";

export function CanteenList() {
  const [canteens, setCanteens] = useState<Array<{ id: string; name: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{ canteens: Array<{ id: string; name: string }> }>("/api/canteens")
      .then((d) => setCanteens(d.canteens))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-destructive">{error}</p>;
  if (!canteens) return <p className="text-muted-foreground">Loading…</p>;
  if (canteens.length === 0) return <p className="text-muted-foreground">No canteens are open.</p>;

  return (
    <div className="flex flex-col gap-3">
      {canteens.map((c) => (
        <Link key={c.id} href={`/menu/${c.id}`}>
          <Card className="flex items-center justify-between p-5 transition-colors hover:bg-muted/50">
            <span className="text-lg font-semibold">{c.name}</span>
            <ChevronRight className="text-muted-foreground" />
          </Card>
        </Link>
      ))}
    </div>
  );
}
