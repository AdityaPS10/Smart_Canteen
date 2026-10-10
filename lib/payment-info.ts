// Shape returned to the browser to start a payment. Shared by server and client.
export interface PaymentInfo {
  mode: "mock" | "razorpay";
  order_id: string;
  gateway_order_id: string;
  amount_paise: number;
  /** Razorpay public key id (razorpay mode only). */
  key_id?: string;
}
