import { describe, expect, it } from "vitest";
import { formulaEstimate, type PredictionFeatures } from "@/lib/prediction-formula";
import { estimateRange } from "@/lib/estimate";

const base: PredictionFeatures = {
  hour: 12,
  weekday: 2,
  units_ahead: 4,
  items_count: 2,
  max_prep_minutes: 6,
  prep_minutes_ahead: 20,
  all_ready_made: false,
  window_remaining_minutes: 3,
  kitchen_staff_count: 2,
  ml_min_samples: 50,
};

describe("formula fallback", () => {
  it("= window remaining + prep ahead / staff + longest prep", () => {
    expect(formulaEstimate(base)).toBe(3 + 20 / 2 + 6);
  });

  it("is 0 for orders of only ready-made items", () => {
    expect(formulaEstimate({ ...base, all_ready_made: true })).toBe(0);
  });

  it("never divides by zero staff", () => {
    expect(formulaEstimate({ ...base, kitchen_staff_count: 0 })).toBe(3 + 20 + 6);
  });
});

describe("estimate range shown to students", () => {
  it("is about 0.85x to 1.2x, rounded", () => {
    expect(estimateRange(10)).toEqual({ low: 9, high: 12 });
    expect(estimateRange(20)).toEqual({ low: 17, high: 24 });
    expect(estimateRange(1)).toEqual({ low: 1, high: 2 });
  });
});
