"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, ButtonLink, Card, Field, Textarea, cx } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { StoreMessages } from "@/i18n/messages/store";
import { ApiError, api, errorMessage } from "@/lib/api";

type Item = { orderItemId: string; name: string; qty: number };

export function ReviewForm({ token, slug, items, m, t }: { token: string; slug: string; items: Item[]; m: StoreMessages; t: CommonMessages }) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { title: string; body: string }>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const rated = items.filter((i) => ratings[i.orderItemId]);
    if (rated.length === 0) {
      setError(m.rateOne);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/public/reviews/${token}`, {
        body: {
          items: rated.map((i) => ({
            orderItemId: i.orderItemId,
            rating: ratings[i.orderItemId],
            comment: String(f.get(`comment-${i.orderItemId}`) ?? "").trim() || undefined,
          })),
        },
      });
      setDone({ title: m.thanksTitle, body: m.thanksBody });
    } catch (err) {
      if (err instanceof ApiError && err.code === "REVIEW_LINK_USED") setDone({ title: m.linkUsedTitle, body: m.linkUsedBody });
      else if (err instanceof ApiError && err.code === "REVIEW_LINK_EXPIRED") setDone({ title: m.linkExpiredTitle, body: m.linkExpiredBody });
      else setError(err instanceof ApiError && err.status === 429 ? m.errRateLimited : errorMessage(err, t.error));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-2 py-8 text-center">
        <p className="text-lg font-semibold">{done.title}</p>
        <p className="text-sm text-stone-600">{done.body}</p>
        <ButtonLink href={`/s/${slug}`} tone="secondary" className="mt-3">
          {m.backToShop}
        </ButtonLink>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {items.map((item) => {
        const value = ratings[item.orderItemId] ?? 0;
        return (
          <Card key={item.orderItemId} className="flex flex-col gap-3">
            <fieldset>
              <legend className="mb-1 font-medium">
                {item.name} <span className="text-sm font-normal text-stone-500">× {item.qty}</span>
              </legend>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label
                    key={n}
                    className="flex size-11 cursor-pointer items-center justify-center rounded-[var(--radius)] text-3xl has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--brand)]"
                  >
                    <input
                      type="radio"
                      name={`rating-${item.orderItemId}`}
                      value={n}
                      checked={value === n}
                      onChange={() => setRatings((r) => ({ ...r, [item.orderItemId]: n }))}
                      className="sr-only"
                    />
                    <span aria-hidden className={cx(n <= value ? "text-amber-500" : "text-stone-300")}>
                      ★
                    </span>
                    <span className="sr-only">{fill(m.starsLabel, { n })}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label={`${m.comment} (${t.optional})`}>
              <Textarea name={`comment-${item.orderItemId}`} maxLength={1000} />
            </Field>
          </Card>
        );
      })}
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" block disabled={busy}>
        {busy ? m.sending : m.sendReviews}
      </Button>
    </form>
  );
}
