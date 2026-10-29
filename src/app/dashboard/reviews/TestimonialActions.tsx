"use client";

import { Alert, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction } from "../products/_components/useAction";

/** Approve or reject a testimonial; either choice can be reversed later. */
export function TestimonialActions({ id, status, labels }: { id: string; status: string; labels: { approve: string; reject: string; testimonialFailed: string } }) {
  const action = useAction(labels.testimonialFailed);
  const set = (next: "APPROVED" | "REJECTED") => action.run(() => api(`/api/testimonials/${id}`, { method: "PATCH", body: { status: next } }));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status !== "APPROVED" && (
          <Button disabled={action.busy} onClick={() => set("APPROVED")}>
            {labels.approve}
          </Button>
        )}
        {status !== "REJECTED" && (
          <Button tone="secondary" disabled={action.busy} onClick={() => set("REJECTED")}>
            {labels.reject}
          </Button>
        )}
      </div>
      {action.error && <Alert tone="error">{action.error}</Alert>}
    </div>
  );
}
