// Error codes raised by the SQL functions (RAISE ... USING message = 'CODE') and by route handlers.

const STATUS: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  ORDER_NOT_FOUND: 404,
  ILLEGAL_TRANSITION: 409,
  SOLD_OUT: 409,
  ITEM_UNAVAILABLE: 409,
  EMPTY_CART: 400,
  NO_CHECKIN: 403,
  QR_INVALID: 400,
  QR_EXPIRED: 400,
  QR_USED_UP: 400,
  QR_WRONG_CANTEEN: 400,
  RETRY_LIMIT: 409,
  NOT_PENDING: 409,
  PAYMENT_GATEWAY: 502,
  MOCK_DISABLED: 404,
  MISSING_SETTING: 500,
};

const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Please log in.",
  FORBIDDEN: "You are not allowed to do this.",
  NOT_FOUND: "Not found.",
  ORDER_NOT_FOUND: "Order not found.",
  ILLEGAL_TRANSITION: "That status change is not allowed.",
  SOLD_OUT: "Sorry, an item just sold out.",
  ITEM_UNAVAILABLE: "An item in your cart is no longer on the menu.",
  EMPTY_CART: "Your cart is empty.",
  NO_CHECKIN: "Scan the QR on the display at the canteen entrance, or order at the cashier.",
  QR_INVALID: "This is not a valid canteen entrance QR.",
  QR_EXPIRED: "This QR code has expired. Scan the new code on the display.",
  QR_USED_UP: "This QR code has been used up. Scan the new code on the display.",
  QR_WRONG_CANTEEN: "This QR code belongs to a different canteen.",
  RETRY_LIMIT: "No payment retries left.",
  NOT_PENDING: "This order is no longer waiting for payment.",
  PAYMENT_GATEWAY: "The payment gateway is not responding. Try again.",
};

export class AppError extends Error {
  constructor(
    public code: string,
    public status: number = STATUS[code] ?? 500,
    message?: string,
    public detail?: string,
  ) {
    super(message ?? MESSAGES[code] ?? code);
  }

  /** Builds an AppError from a PostgREST / Postgres error raised by our SQL functions. */
  static fromDb(err: { message?: string; details?: string | null; code?: string }): AppError {
    const code = (err.message ?? "").trim();
    if (code in STATUS) {
      const detail = err.details ?? undefined;
      let msg = MESSAGES[code];
      if (code === "SOLD_OUT" && detail) msg = `Sorry, ${detail} just sold out. Your cart was updated.`;
      if (code === "ITEM_UNAVAILABLE" && detail) msg = `${detail} is no longer on the menu. Your cart was updated.`;
      return new AppError(code, STATUS[code], msg, detail);
    }
    return new AppError("DB_ERROR", 500, "Something went wrong. Please try again.", err.message);
  }
}
