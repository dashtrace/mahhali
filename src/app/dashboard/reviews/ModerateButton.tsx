"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";

/** Hide or publish again; the text itself is never editable. */
export function ModerateButton({ id, hidden, labels }: { id: string; hidden: boolean; labels: { hide: string; unhide: string; failed: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/reviews/${id}`, { method: "PATCH", body: { status: hidden ? "PUBLISHED" : "HIDDEN" } });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, labels.failed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button tone="secondary" onClick={toggle} disabled={busy}>
        {hidden ? labels.unhide : labels.hide}
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
