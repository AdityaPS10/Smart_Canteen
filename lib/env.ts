// Server-side environment access. Never import from client components.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return v;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  qrSecret: () => required("QR_SECRET"),
  kioskKey: () => required("KIOSK_KEY"),
  cronSecret: () => required("CRON_SECRET"),
  appUrl: () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  collegeDomain: () => process.env.COLLEGE_EMAIL_DOMAIN,
  mlUrl: () => process.env.ML_URL,
  razorpayKeyId: () => process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: () => process.env.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: () => process.env.RAZORPAY_WEBHOOK_SECRET,
};

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

/** Razorpay is used only when asked for AND all keys exist; otherwise the clearly-labelled mock. */
export function paymentMode(): "razorpay" | "mock" {
  const wantsRazorpay = (process.env.PAYMENT_MODE ?? "mock") === "razorpay";
  const hasKeys = Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET,
  );
  return wantsRazorpay && hasKeys ? "razorpay" : "mock";
}
