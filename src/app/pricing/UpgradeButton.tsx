"use client";

import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";

/** Starts a Stripe Checkout Session and sends the owner there. */
export function UpgradeButton({ label, busyLabel, errorLabel }: { label: string; busyLabel: string; errorLabel: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api<{ url: string }>("/api/billing/checkout", { method: "POST" });
      window.location.assign(url);
    } catch (e) {
      setError(errorMessage(e, errorLabel));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button block onClick={upgrade} disabled={busy}>
        {busy ? busyLabel : label}
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
