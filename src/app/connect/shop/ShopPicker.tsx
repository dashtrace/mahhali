"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, cx } from "@/components/ui";
import type { connectMessages } from "@/i18n/messages/connect";
import { authClient, followOAuthRedirect } from "@/lib/authClient";

type Shop = { id: string; name: string; role: string };

export function ShopPicker({ shops, m }: { shops: Shop[]; m: (typeof connectMessages)["en"] }) {
  const [selected, setSelected] = useState(shops[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const picked = await fetch("/api/connect/shop", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shopId: selected }),
    });
    // The plugin client adds this page's signed query, so the flow resumes for the shop just picked.
    const { data } = picked.ok
      ? await authClient.$fetch("/oauth2/continue", { method: "POST", body: { postLogin: true } })
      : { data: null };
    if (!followOAuthRedirect(data)) {
      setError(m.expired);
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <fieldset className="flex flex-col gap-2">
        {shops.map((shop) => (
          <label
            key={shop.id}
            className={cx(
              "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4",
              selected === shop.id ? "border-sl-accent bg-sl-cat" : "border-sl-border",
            )}
          >
            <input
              type="radio"
              name="shop"
              value={shop.id}
              checked={selected === shop.id}
              onChange={() => setSelected(shop.id)}
              className="size-4 accent-current"
            />
            <span className="flex-1 font-medium">{shop.name}</span>
            <span className="text-sm text-sl-muted">{shop.role}</span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" disabled={pending || !selected} block className="mt-1 min-h-12">
        {pending ? m.working : m.pickContinue}
      </Button>
    </form>
  );
}
