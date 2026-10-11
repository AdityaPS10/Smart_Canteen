"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Quantity control with 44 px touch targets. */
export function QtyStepper({
  value,
  onChange,
  max = 50,
  disabled,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  disabled?: boolean;
  /** Item name, for screen readers. */
  label?: string;
}) {
  if (value <= 0) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-11 min-w-24 rounded-full font-semibold"
        disabled={disabled}
        onClick={() => onChange(1)}
        aria-label={label ? `Add ${label}` : "Increase"}
      >
        <Plus /> Add
      </Button>
    );
  }
  return (
    <div className="flex h-11 items-center rounded-full border bg-card shadow-xs" role="group" aria-label={label}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="rounded-full"
        aria-label="Decrease"
        disabled={disabled}
        onClick={() => onChange(value - 1)}
      >
        <Minus />
      </Button>
      <span className={cn("w-7 text-center text-base font-semibold tabular-nums")} aria-live="polite">
        {value}
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="rounded-full"
        aria-label="Increase"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus />
      </Button>
    </div>
  );
}
