"use client";

import { useState } from "react";
import { ClipboardList, Loader2, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/empty-state";
import { fetchJson, useLiveData } from "@/hooks/use-live-data";
import { cn, formatPaise, parseRupeesToPaise } from "@/lib/utils";
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
      {message && (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Menu and stock</CardTitle>
          <CardDescription>Edit price, count and prep time, then Save. Switches apply at once.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && !data && (
            <Alert variant="destructive">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          {!data && !error && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}
          {data && data.items.length === 0 && (
            <EmptyState icon={<ClipboardList />} title="No dishes yet" description="Add the first dish above." />
          )}
          {data && data.items.length > 0 && (
            <div className={cn(ROW_GRID, "hidden border-b pb-2 text-sm font-medium text-muted-foreground lg:grid")}>
              <span>Dish</span>
              <span>Price (₹)</span>
              <span>Count</span>
              <span>Prep min</span>
              <span className="text-center">Ready made</span>
              <span className="text-center">Holds well</span>
              <span className="text-center">On menu</span>
              <span />
            </div>
          )}
          <div className="flex flex-col gap-3 lg:gap-0 lg:divide-y">
            {(data?.items ?? []).map((item) => (
              <MenuRow key={item.id + item.stock_count + item.price_paise + item.prep_minutes} item={item} onPatch={patch} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** One layout for header and rows on large screens; rows become cards on small screens. */
const ROW_GRID = "lg:grid-cols-[minmax(9rem,1.5fr)_7rem_6rem_5.5rem_6rem_6rem_6rem_6.5rem] lg:items-center lg:gap-3";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted-foreground lg:sr-only">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md bg-muted px-2 py-2.5 lg:bg-transparent lg:p-0">
      <span className="whitespace-nowrap text-sm lg:sr-only">{label}</span>
      {children}
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
    <div
      className={cn(
        ROW_GRID,
        "grid grid-cols-3 gap-3 rounded-lg border p-4 lg:rounded-none lg:border-0 lg:px-0 lg:py-3",
        !item.active && "opacity-70",
      )}
    >
      <div className="col-span-3 flex flex-wrap items-center gap-2 lg:col-span-1">
        <span className="font-semibold">{item.name}</span>
        {item.stock_count === 0 && <Badge variant="destructive">Sold out</Badge>}
        {!item.active && <Badge variant="outline">Hidden</Badge>}
      </div>
      <Field label="Price (₹)">
        <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-label={`${item.name} price`} />
      </Field>
      <Field label="Count">
        <Input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} aria-label={`${item.name} count`} />
      </Field>
      <Field label="Prep min">
        <Input
          inputMode="numeric"
          value={prep}
          disabled={item.ready_made}
          onChange={(e) => setPrep(e.target.value)}
          aria-label={`${item.name} prep minutes`}
        />
      </Field>
      <Toggle label="Ready made">
        <Switch
          aria-label="Ready made"
          checked={item.ready_made}
          disabled={busy}
          onCheckedChange={(v) => run(v ? { ready_made: true, prep_minutes: 0 } : { ready_made: false })}
        />
      </Toggle>
      <Toggle label="Holds well">
        <Switch aria-label="Holds well" checked={item.holds_well} disabled={busy} onCheckedChange={(v) => run({ holds_well: v })} />
      </Toggle>
      <Toggle label="On menu">
        <Switch aria-label="On menu" checked={item.active} disabled={busy} onCheckedChange={(v) => run({ active: v })} />
      </Toggle>
      <Button
        className="col-span-3 lg:col-span-1"
        variant={dirty ? "default" : "outline"}
        disabled={!dirty || !valid || busy}
        onClick={() => run({ price_paise: pricePaise!, stock_count: countNum!, prep_minutes: prepNum! })}
      >
        <Save /> Save
      </Button>
    </div>
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
          <Button type="submit" className="order-last col-span-2 md:order-none md:col-span-1" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Plus />} Add dish
          </Button>
          <div className="col-span-2 flex flex-wrap gap-x-6 gap-y-3 md:col-span-6">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch checked={readyMade} onCheckedChange={setReadyMade} aria-label="Ready made" /> Ready made
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch checked={holdsWell} onCheckedChange={setHoldsWell} aria-label="Holds well" /> Holds well
            </label>
          </div>
          {error && <p className="col-span-2 text-sm font-medium text-danger md:col-span-6">{error}</p>}
          {price && parseRupeesToPaise(price) !== null && (
            <p className="col-span-2 text-sm text-muted-foreground md:col-span-6">
              Price: {formatPaise(parseRupeesToPaise(price)!)}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
