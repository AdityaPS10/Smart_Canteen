"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CashOrder } from "./cash-order";
import { MenuEditor } from "./menu-editor";
import { PaymentsLog } from "./payments-log";

const TABS = [
  { id: "order", label: "New cash order" },
  { id: "menu", label: "Menu & stock" },
  { id: "payments", label: "Payments" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function CashierDashboard({ canteenId }: { canteenId: string }) {
  const [tab, setTab] = useState<TabId>(TABS[0].id);
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="inline-flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "order" && <CashOrder canteenId={canteenId} />}
      {tab === "menu" && <MenuEditor canteenId={canteenId} />}
      {tab === "payments" && <PaymentsLog canteenId={canteenId} />}
    </div>
  );
}
