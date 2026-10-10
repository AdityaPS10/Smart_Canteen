"use client";

import type { PaymentInfo } from "./payment-info";

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: () => void): void;
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

let scriptPromise: Promise<RazorpayCtor> | null = null;

function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Razorpay failed to load")));
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("Could not load the payment page. Check your connection."));
      };
      document.body.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Opens the payment for one attempt. In mock mode this navigates to the MOCK page.
 * In Razorpay mode it opens Razorpay checkout limited to UPI (GPay / PhonePe ...). The result shown to the
 * student always comes from the server (webhook), so every outcome just goes to the order screen.
 */
export async function launchPayment(info: PaymentInfo, navigate: (url: string) => void): Promise<void> {
  const orderUrl = `/orders/${info.order_id}`;
  if (info.mode === "mock") {
    navigate(`/pay/mock?order=${info.order_id}&attempt=${encodeURIComponent(info.gateway_order_id)}`);
    return;
  }
  const Razorpay = await loadRazorpay();
  const rzp = new Razorpay({
    key: info.key_id,
    order_id: info.gateway_order_id,
    amount: info.amount_paise,
    currency: "INR",
    name: "Smart Canteen",
    description: "Canteen order",
    // Each failure is one counted attempt; the app offers the retry.
    retry: { enabled: false },
    config: {
      display: {
        blocks: { upi: { name: "Pay by UPI (GPay / PhonePe)", instruments: [{ method: "upi" }] } },
        sequence: ["block.upi"],
        preferences: { show_default_blocks: false },
      },
    },
    handler: () => navigate(orderUrl),
    modal: { ondismiss: () => navigate(orderUrl) },
  });
  rzp.on("payment.failed", () => navigate(orderUrl));
  rzp.open();
}
