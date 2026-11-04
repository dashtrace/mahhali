import type { OrderStatus } from "@prisma/client";

// New is the plain blue pill.
const TONES: Record<OrderStatus, string> = {
  NEW: "",
  CONFIRMED: "amber",
  PACKED: "amber",
  OUT_FOR_DELIVERY: "gray",
  DELIVERED: "green",
  CANCELLED: "red",
  RETURNED: "red",
};

export function StatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  return <span className={`mini-badge ${TONES[status]}`}>{label}</span>;
}
