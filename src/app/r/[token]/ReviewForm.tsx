"use client";

import { useState, type FormEvent } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Alert, Button, ButtonLink, Card, Field, Textarea, cx } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CheckoutMessages } from "@/i18n/messages/checkout";
import { ApiError, api, errorMessage } from "@/lib/api";

type Item = { orderItemId: string; name: string; qty: number };
const WORDS = ["rate1", "rate2", "rate3", "rate4", "rate5"] as const;

export function ReviewForm({ token, slug, items, expires, m }: { token: string; slug: string; items: Item[]; expires: string; m: CheckoutMessages }) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { title: string; body: string; icon: IconName }>(null);

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
      setDone({ title: m.thanksTitle, body: m.thanksBody, icon: "check" });
    } catch (err) {
      if (err instanceof ApiError && err.code === "REVIEW_LINK_USED") setDone({ title: m.linkUsedTitle, body: m.linkUsedBody, icon: "info" });
      else if (err instanceof ApiError && err.code === "REVIEW_LINK_EXPIRED") setDone({ title: m.linkExpiredTitle, body: m.linkExpiredBody, icon: "calendar" });
      else setError(err instanceof ApiError && err.status === 429 ? m.errRateLimited : errorMessage(err, m.error));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card role="status" className="flex flex-col items-center gap-2 rounded-[17px] px-5 py-10 text-center">
        <span aria-hidden className="mb-2 grid size-14 place-items-center rounded-full bg-sl-accent text-sl-accent-ink">
          <Icon name={done.icon} className="size-7" />
        </span>
        <p className="sl-heading text-2xl leading-tight">{done.title}</p>
        <p className="text-sm leading-normal text-sl-muted">{done.body}</p>
        <ButtonLink href={`/s/${slug}`} tone="secondary" className="mt-4">
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
          <Card key={item.orderItemId} className="flex flex-col gap-3 rounded-[17px] p-4 sm:p-5">
            <fieldset>
              <legend className="font-bold leading-snug">
                <bdi>{item.name}</bdi> <span className="text-sm font-normal text-sl-muted">× {item.qty}</span>
              </legend>
              <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label
                    key={n}
                    className="grid size-11 cursor-pointer place-items-center rounded-sl has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-sl-accent"
                  >
                    <input
                      type="radio"
                      name={`rating-${item.orderItemId}`}
                      value={n}
                      checked={value === n}
                      onChange={() => setRatings((r) => ({ ...r, [item.orderItemId]: n }))}
                      className="sr-only"
                    />
                    <Icon name="star" solid className={cx("size-8 transition", n <= value ? "text-sl-star" : "text-sl-control")} />
                    <span className="sr-only">{fill(m.starsLabel, { n })}</span>
                  </label>
                ))}
                <span aria-hidden className="ms-2 text-sm font-bold text-sl-muted">
                  {value ? m[WORDS[value - 1]] : null}
                </span>
              </div>
            </fieldset>
            <Field label={`${m.comment} (${m.optional})`}>
              <Textarea name={`comment-${item.orderItemId}`} maxLength={1000} placeholder={m.commentPlaceholder} />
            </Field>
          </Card>
        );
      })}
      <Alert tone="note">
        <p>{m.shownAs}</p>
        <p className="mt-1 text-sl-muted">{fill(m.expiresOn, { date: expires })}</p>
      </Alert>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" block className="min-h-12 text-[15px]" disabled={busy}>
        {busy ? m.sending : m.sendReviews}
      </Button>
    </form>
  );
}
