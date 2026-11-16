"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";

/** Pending reviews are private until approved. Rejected reviews remain hidden. */
export function ModerateButton({
  id,
  status,
  labels,
}: {
  id: string;
  status: "PENDING" | "PUBLISHED" | "HIDDEN";
  labels: { approve: string; reject: string; hide: string; unhide: string; failed: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(next: "PUBLISHED" | "HIDDEN") {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/reviews/${id}`, { method: "PATCH", body: { status: next } });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, labels.failed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "PENDING" ? (
          <>
            <button type="button" className="btn tiny primary" onClick={() => changeStatus("PUBLISHED")} disabled={busy}>{labels.approve}</button>
            <button type="button" className="btn tiny" onClick={() => changeStatus("HIDDEN")} disabled={busy}>{labels.reject}</button>
          </>
        ) : (
          <button type="button" className="btn tiny" onClick={() => changeStatus(status === "HIDDEN" ? "PUBLISHED" : "HIDDEN")} disabled={busy}>
            {status === "HIDDEN" ? labels.unhide : labels.hide}
          </button>
        )}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
