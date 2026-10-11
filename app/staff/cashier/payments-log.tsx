"use client";

import { Banknote } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { useLiveData } from "@/hooks/use-live-data";
import { formatPaise, formatTimeIST } from "@/lib/utils";

interface Log {
  date: string;
  total_paise: number;
  payments: Array<{
    created_at: string;
    token_number: number;
    amount_paise: number;
    cashier: string | null;
    running_total_paise: number;
  }>;
}

/** Cash payments of the day with a running total. */
export function PaymentsLog({ canteenId }: { canteenId: string }) {
  const { data, error } = useLiveData<Log>("/api/cashier/payments", [
    { channel: `canteen:${canteenId}`, events: ["orders_changed"] },
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
          <span className="text-sm font-medium text-muted-foreground">Cash collected today</span>
          {data ? (
            <span className="text-2xl font-semibold tabular-nums sm:text-3xl">{formatPaise(data.total_paise)}</span>
          ) : (
            <Skeleton className="h-9 w-32" />
          )}
        </div>
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
          <span className="text-sm font-medium text-muted-foreground">Cash payments</span>
          {data ? (
            <span className="text-2xl font-semibold tabular-nums sm:text-3xl">{data.payments.length}</span>
          ) : (
            <Skeleton className="h-9 w-16" />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payments log</CardTitle>
          <CardDescription>{data ? data.date : "Today"} · newest first</CardDescription>
        </CardHeader>
        <CardContent>
          {error && !data && (
            <Alert variant="destructive">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          {!data && !error && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          )}
          {data?.payments.length === 0 && (
            <EmptyState icon={<Banknote />} title="No cash payments yet today" description="Cash orders appear here." />
          )}
          {data && data.payments.length > 0 && (
            <Table className="[&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-3 sm:[&_th]:px-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="hidden sm:table-cell">Cashier</TableHead>
                  <TableHead className="text-right"><span className="sm:hidden">So far</span><span className="hidden sm:inline">Running total</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{formatTimeIST(p.created_at)}</TableCell>
                    <TableCell className="token-num text-lg">{p.token_number}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatPaise(p.amount_paise)}</TableCell>
                    <TableCell className="hidden sm:table-cell">{p.cashier ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatPaise(p.running_total_paise)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
