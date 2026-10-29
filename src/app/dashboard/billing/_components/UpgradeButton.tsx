"use client";

import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";

/** Starts Stripe Checkout and leaves the app for its hosted page. */
export function UpgradeButton({ label, busyLabel, fallback }: { label: string; busyLabel: string; fallback: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}
      <Button
        block
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const { url } = await api<{ url: string }>("/api/billing/checkout", { method: "POST" });
            window.location.assign(url);
          } catch (e) {
            setError(errorMessage(e, fallback));
            setBusy(false);
          }
        }}
      >
        {busy ? busyLabel : label}
      </Button>
    </>
  );
}
