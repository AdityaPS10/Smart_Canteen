import type { Role } from "./access";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_FAILED"
  | "PAID"
  | "PREPARING"
  | "READY"
  | "GIVEN"
  | "EXPIRED";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  canteen_id: string | null;
  id_card_code: string;
  created_at: string;
}

export interface Canteen {
  id: string;
  name: string;
  active: boolean;
}

export interface MenuItem {
  id: string;
  canteen_id: string;
  name: string;
  price_paise: number;
  stock_count: number;
  ready_made: boolean;
  holds_well: boolean;
  prep_minutes: number;
  active: boolean;
}

/** What students and the TV see (no stock numbers beyond "available"). */
export interface PublicMenuItem {
  id: string;
  name: string;
  price_paise: number;
  ready_made: boolean;
}

export interface Order {
  id: string;
  canteen_id: string;
  student_id: string | null;
  source: "app" | "cashier";
  customer_name: string | null;
  token_number: number | null;
  service_date: string;
  status: OrderStatus;
  total_paise: number;
  payment_attempts: number;
  estimated_minutes: number | null;
  estimate_source: "formula" | "ml" | "ml_sample" | null;
  created_at: string;
  paid_at: string | null;
  ready_at: string | null;
  given_at: string | null;
  expired_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  name_snapshot: string;
  unit_price_paise: number;
  quantity: number;
  status: "pending" | "preparing" | "ready";
  ready_at: string | null;
}

export interface CartLine {
  menu_item_id: string;
  quantity: number;
}
