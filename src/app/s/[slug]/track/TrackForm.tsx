"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowOut } from "@/components/Icon";
import { Button } from "@/components/ui";
import type { CheckoutMessages } from "@/i18n/messages/checkout";
import { ApiError, api, errorMessage } from "@/lib/api";

// Number plus phone, never the number alone: order numbers are sequential and easy to guess.
export function TrackForm({ slug, number, m }: { slug: string; number?: number; m: CheckoutMessages }) {
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
      // A malformed phone is a 400 about its format only; any miss is one generic 404.
      const badPhone = err instanceof ApiError && Array.isArray(err.details) && (err.details as { path?: string }[]).some((d) => d?.path === "phone");
      setError(
        badPhone
          ? m.phoneInvalid
          : err instanceof ApiError && (err.status === 404 || err.status === 400)
            ? m.trackNotFound
            : err instanceof ApiError && err.status === 429
              ? m.errRateLimited
              : errorMessage(err, m.error),
      );
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="sl-track-form">
      <label htmlFor="track-number">
        {m.orderNumber}
        <input
          id="track-number"
          name="number"
          defaultValue={number}
          required
          inputMode="numeric"
          pattern="#?\s*\d{1,10}"
          placeholder={m.orderNumberPlaceholder}
          autoComplete="off"
          dir="ltr"
        />
      </label>
      <label htmlFor="track-phone">
        {m.phone}
        <input id="track-phone" name="phone" type="tel" required placeholder={m.phonePlaceholder} autoComplete="tel" inputMode="tel" dir="ltr" />
      </label>
      <Button type="submit" block className="sl-action sl-track-submit" disabled={busy}>
        {busy ? m.searching : m.findOrder}
        {!busy && <ArrowOut />}
      </Button>
      <p className="sl-track-hint">{m.trackHint}</p>
      {error && (
        <p role="alert" className="sl-order-alert">
          {error}
        </p>
      )}
    </form>
  );
}
