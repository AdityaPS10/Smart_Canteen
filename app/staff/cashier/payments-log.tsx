"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    <Card>
      <CardHeader>
        <CardTitle>Cash payments {data ? `· ${data.date}` : ""}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && !data && <p className="text-destructive">{error.message}</p>}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Token</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead className="text-right">Running total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No cash payments yet today.
                </TableCell>
              </TableRow>
            )}
            {data?.payments.map((p, i) => (
              <TableRow key={i}>
                <TableCell>{formatTimeIST(p.created_at)}</TableCell>
                <TableCell className="font-semibold tabular-nums">{p.token_number}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPaise(p.amount_paise)}</TableCell>
                <TableCell>{p.cashier ?? "-"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatPaise(p.running_total_paise)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-bold">
                Total
              </TableCell>
              <TableCell className="text-right text-lg font-bold tabular-nums">
                {formatPaise(data?.total_paise ?? 0)}
              </TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
