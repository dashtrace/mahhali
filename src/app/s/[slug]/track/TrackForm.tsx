"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import type { CommonMessages } from "@/i18n/messages/common";
import type { StoreMessages } from "@/i18n/messages/store";
import { ApiError, api, errorMessage } from "@/lib/api";

export function TrackForm({ slug, m, t }: { slug: string; m: StoreMessages; t: CommonMessages }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { token } = await api<{ token: string }>(`/api/public/shops/${slug}/track`, {
        body: { number: Number(String(f.get("number")).replace(/\D/g, "")), phone: String(f.get("phone")) },
      });
      router.push(`/t/${token}`);
      return;
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? m.trackNotFound
          : err instanceof ApiError && err.status === 429
            ? m.errRateLimited
            : errorMessage(err, t.error),
      );
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={m.orderNumber}>
        <Input name="number" required inputMode="numeric" pattern="#?\d{1,10}" placeholder="1042" dir="ltr" />
      </Field>
      <Field label={m.phone}>
        <Input name="phone" type="tel" required defaultValue="+961 " autoComplete="tel" inputMode="tel" dir="ltr" />
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" block disabled={busy}>
        {busy ? m.searching : m.findOrder}
      </Button>
    </form>
  );
}
