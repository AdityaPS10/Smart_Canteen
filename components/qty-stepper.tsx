"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QtyStepper({
  value,
  onChange,
  max = 50,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant="outline"
        aria-label="Decrease"
        disabled={disabled || value <= 0}
        onClick={() => onChange(value - 1)}
      >
        <Minus />
      </Button>
      <span className="w-6 text-center font-semibold tabular-nums">{value}</span>
      <Button
        type="button"
        size="icon"
        variant="outline"
        aria-label="Increase"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus />
      </Button>
    </div>
  );
}
