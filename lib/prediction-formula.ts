// Fallback estimate when the ML service is down or has too little data (spec section 12):
//   remaining time of the current batch window
// + (prep minutes of the units ahead in the queue / kitchen_staff_count)
// + the longest prep_minutes in the order.
export interface PredictionFeatures {
  hour: number;
  weekday: number;
  units_ahead: number;
  items_count: number;
  max_prep_minutes: number;
  prep_minutes_ahead: number;
  all_ready_made: boolean;
  window_remaining_minutes: number;
  kitchen_staff_count: number;
  ml_min_samples: number;
}

export function formulaEstimate(f: PredictionFeatures): number {
  if (f.all_ready_made) return 0;
  const staff = Math.max(1, f.kitchen_staff_count);
  const minutes = Number(f.window_remaining_minutes) + f.prep_minutes_ahead / staff + f.max_prep_minutes;
  return Math.max(1, Math.ceil(minutes));
}
