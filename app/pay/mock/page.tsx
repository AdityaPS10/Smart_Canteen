import { MockPayClient } from "./mock-pay-client";

export default async function MockPayPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; attempt?: string }>;
}) {
  const { order, attempt } = await searchParams;
  if (!order || !attempt) return <p className="p-6">Missing payment details.</p>;
  return <MockPayClient orderId={order} gatewayOrderId={attempt} />;
}
