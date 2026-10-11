"use client";

import { useState } from "react";
import { Banknote, ClipboardList, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { CashOrder } from "./cash-order";
import { MenuEditor } from "./menu-editor";
import { PaymentsLog } from "./payments-log";

const TABS = [
  { id: "order", label: "New cash order", short: "Order", icon: Banknote },
  { id: "menu", label: "Menu & stock", short: "Menu", icon: ClipboardList },
  { id: "payments", label: "Payments", short: "Payments", icon: ReceiptText },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function CashierDashboard({ canteenId }: { canteenId: string }) {
  const [tab, setTab] = useState<TabId>(TABS[0].id);
  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        className="grid w-full grid-cols-3 gap-1 rounded-lg border bg-muted p-1 sm:inline-grid sm:w-fit"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-label={t.label}
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" aria-hidden />
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>
      {tab === "order" && <CashOrder canteenId={canteenId} />}
      {tab === "menu" && <MenuEditor canteenId={canteenId} />}
      {tab === "payments" && <PaymentsLog canteenId={canteenId} />}
    </div>
  );
}
