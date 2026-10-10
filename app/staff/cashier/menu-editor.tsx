"use client";

import { useState } from "react";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchJson, useLiveData } from "@/hooks/use-live-data";
import { formatPaise, parseRupeesToPaise } from "@/lib/utils";
import type { MenuItem } from "@/lib/types";

async function send(method: "POST" | "PATCH", body: unknown) {
  return fetchJson<{ item: MenuItem }>("/api/menu", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function MenuEditor({ canteenId }: { canteenId: string }) {
  const { data, error, reload } = useLiveData<{ items: MenuItem[] }>(
    `/api/menu?canteenId=${canteenId}&all=1`,
    [{ channel: `canteen:${canteenId}`, events: ["menu_changed"] }],
  );
  const [message, setMessage] = useState<string | null>(null);

  async function patch(body: Partial<MenuItem> & { id: string }) {
    setMessage(null);
    try {
      await send("PATCH", body);
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <AddDishForm
        onAdded={async () => {
          await reload();
        }}
      />
      {message && <p className="text-sm text-destructive">{message}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Menu and stock</CardTitle>
        </CardHeader>
        <CardContent>
          {error && !data && <p className="text-destructive">{error.message}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dish</TableHead>
                <TableHead>Price (₹)</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Prep min</TableHead>
                <TableHead>Ready made</TableHead>
                <TableHead>Holds well</TableHead>
                <TableHead>On menu</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((item) => (
                <MenuRow key={item.id + item.stock_count + item.price_paise + item.prep_minutes} item={item} onPatch={patch} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MenuRow({ item, onPatch }: { item: MenuItem; onPatch: (b: Partial<MenuItem> & { id: string }) => Promise<void> }) {
  const [price, setPrice] = useState((item.price_paise / 100).toFixed(2));
  const [count, setCount] = useState(String(item.stock_count));
  const [prep, setPrep] = useState(String(item.prep_minutes));
  const [busy, setBusy] = useState(false);

  const pricePaise = parseRupeesToPaise(price);
  const countNum = /^\d+$/.test(count) ? Number(count) : null;
  const prepNum = /^\d+$/.test(prep) ? Number(prep) : null;
  const dirty =
    pricePaise !== item.price_paise || countNum !== item.stock_count || prepNum !== item.prep_minutes;
  const valid = pricePaise !== null && pricePaise > 0 && countNum !== null && prepNum !== null && prepNum <= 240;

  async function run(body: Partial<MenuItem>) {
    setBusy(true);
    await onPatch({ id: item.id, ...body });
    setBusy(false);
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex flex-col gap-1">
          {item.name}
          {item.stock_count === 0 && <Badge variant="destructive" className="w-fit">Sold out</Badge>}
        </div>
      </TableCell>
      <TableCell>
        <Input className="w-24" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      </TableCell>
      <TableCell>
        <Input className="w-20" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
      </TableCell>
      <TableCell>
        <Input
          className="w-16"
          inputMode="numeric"
          value={prep}
          disabled={item.ready_made}
          onChange={(e) => setPrep(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Switch
          aria-label="Ready made"
          checked={item.ready_made}
          disabled={busy}
          onCheckedChange={(v) => run(v ? { ready_made: true, prep_minutes: 0 } : { ready_made: false })}
        />
      </TableCell>
      <TableCell>
        <Switch aria-label="Holds well" checked={item.holds_well} disabled={busy} onCheckedChange={(v) => run({ holds_well: v })} />
      </TableCell>
      <TableCell>
        <Switch aria-label="On menu" checked={item.active} disabled={busy} onCheckedChange={(v) => run({ active: v })} />
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          disabled={!dirty || !valid || busy}
          onClick={() => run({ price_paise: pricePaise!, stock_count: countNum!, prep_minutes: prepNum! })}
        >
          <Save /> Save
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AddDishForm({ onAdded }: { onAdded: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [count, setCount] = useState("");
  const [prep, setPrep] = useState("5");
  const [readyMade, setReadyMade] = useState(false);
  const [holdsWell, setHoldsWell] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const pricePaise = parseRupeesToPaise(price);
    if (!name.trim() || !pricePaise || !/^\d+$/.test(count) || !/^\d+$/.test(prep)) {
      setError("Enter a name, a price, a count and prep minutes.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await send("POST", {
        name: name.trim(),
        price_paise: pricePaise,
        stock_count: Number(count),
        ready_made: readyMade,
        holds_well: holdsWell,
        prep_minutes: readyMade ? 0 : Number(prep),
      });
      setName("");
      setPrice("");
      setCount("");
      await onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a dish</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 md:grid-cols-6 md:items-end">
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="dish-name">Name</Label>
            <Input id="dish-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dish-price">Price (₹)</Label>
            <Input id="dish-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dish-count">Count</Label>
            <Input id="dish-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dish-prep">Prep min</Label>
            <Input
              id="dish-prep"
              inputMode="numeric"
              value={readyMade ? "0" : prep}
              disabled={readyMade}
              onChange={(e) => setPrep(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            <Plus /> Add
          </Button>
          <div className="col-span-2 flex flex-wrap gap-6 md:col-span-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={readyMade} onCheckedChange={setReadyMade} aria-label="Ready made" /> Ready made
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={holdsWell} onCheckedChange={setHoldsWell} aria-label="Holds well" /> Holds well
            </label>
          </div>
          {error && <p className="col-span-2 text-sm text-destructive md:col-span-6">{error}</p>}
          {price && parseRupeesToPaise(price) !== null && (
            <p className="col-span-2 text-xs text-muted-foreground md:col-span-6">
              Price: {formatPaise(parseRupeesToPaise(price)!)}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
