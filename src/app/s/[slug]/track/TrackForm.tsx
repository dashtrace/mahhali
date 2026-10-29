"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Alert, Button } from "@/components/ui";
import type { CheckoutMessages } from "@/i18n/messages/checkout";
import { ApiError, api, errorMessage } from "@/lib/api";

// Number plus phone, never the number alone: order numbers are sequential and easy to guess.
export function TrackForm({ slug, m }: { slug: string; m: CheckoutMessages }) {
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
    <form onSubmit={submit} className="flex flex-col gap-4">
      <SearchBox id="track-number" label={m.orderNumber} icon="box">
        <input
          id="track-number"
          name="number"
          required
          inputMode="numeric"
          pattern="#?\s*\d{1,10}"
          placeholder={m.orderNumberPlaceholder}
          autoComplete="off"
          dir="ltr"
          className={inputClass}
        />
      </SearchBox>
      <SearchBox id="track-phone" label={m.phone} icon="phone">
        <input
          id="track-phone"
          name="phone"
          type="tel"
          required
          placeholder={m.phonePlaceholder}
          autoComplete="tel"
          inputMode="tel"
          dir="ltr"
          className={inputClass}
        />
      </SearchBox>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" block className="min-h-12 text-[15px]" disabled={busy}>
        {busy ? m.searching : m.findOrder}
        {!busy && <Icon name="arrow" className="size-4" />}
      </Button>
    </form>
  );
}

// The inputs stay dir="ltr" for digits; rtl:text-end keeps them beside the icon on Arabic pages.
const inputClass = "min-h-11 min-w-0 flex-1 bg-transparent text-base text-sl-fg outline-none placeholder:text-sl-muted rtl:text-end";

/** The mockup's track-search-box: an accent icon and a bare input in a soft box that takes the focus ring. */
function SearchBox({ id, label, icon, children }: { id: string; label: string; icon: IconName; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-bold">
        {label}
      </label>
      <div className="flex items-center gap-2.5 rounded-[11px] border border-sl-border bg-sl-bg px-3 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-sl-accent">
        <Icon name={icon} className="size-[19px] shrink-0 text-sl-accent" />
        {children}
      </div>
    </div>
  );
}
