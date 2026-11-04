"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon, type IconName } from "@/components/Icon";
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
      <section role="status" className="sl-review-success sl-on-surface">
        <span aria-hidden className="sl-review-done-icon">
          <Icon name={done.icon} className="size-7" />
        </span>
        <h2>{done.title}</h2>
        <p>{done.body}</p>
        <Link href={`/s/${slug}`} className="sl-text-cta">
          {m.backToShop}
          <Icon name="arrowOut" className="sl-arrow-out" />
        </Link>
      </section>
    );
  }

  const someUnrated = items.some((i) => ratings[i.orderItemId]) && items.some((i) => !ratings[i.orderItemId]);

  return (
    <form onSubmit={submit}>
      {items.map((item) => {
        const value = ratings[item.orderItemId] ?? 0;
        return (
          <div key={item.orderItemId} className="sl-review-panel">
            <div className="sl-review-product">
              <strong>
                <bdi>{item.name}</bdi>
              </strong>
              <small>{fill(m.purchasedQty, { n: item.qty })}</small>
            </div>
            <fieldset>
              <legend className="sl-review-label">
                <span className="sr-only">
                  <bdi>{item.name}</bdi>:{" "}
                </span>
                {m.yourRating}
              </legend>
              <div className="sl-rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} data-on={n <= value || undefined}>
                    <input
                      type="radio"
                      name={`rating-${item.orderItemId}`}
                      value={n}
                      checked={value === n}
                      onChange={() => setRatings((r) => ({ ...r, [item.orderItemId]: n }))}
                      className="sr-only"
                    />
                    <span aria-hidden>★</span>
                    <span className="sr-only">{fill(m.starsLabel, { n })}</span>
                  </label>
                ))}
                <span aria-hidden className="sl-rating-word">
                  {value ? m[WORDS[value - 1]] : null}
                </span>
              </div>
            </fieldset>
            <label className="sl-review-label" htmlFor={`comment-${item.orderItemId}`}>
              {m.comment} ({m.optional})
            </label>
            <textarea id={`comment-${item.orderItemId}`} name={`comment-${item.orderItemId}`} maxLength={1000} placeholder={m.commentPlaceholder} className="sl-review-textarea" />
          </div>
        );
      })}
      <div className="sl-review-note sl-on-surface">
        <strong>{m.verifiedNote}</strong>
        <p>{m.shownAs}</p>
        <small>{fill(m.expiresOn, { date: expires })}</small>
      </div>
      {/* The first submit uses up the link, so say so while unrated items can still be rated. */}
      <div aria-live="polite">{someUnrated && <p className="sl-order-alert sl-review-warning">{m.unratedWarning}</p>}</div>
      <p role="alert" className="sl-review-error">
        {error}
      </p>
      <button type="submit" className="sl-review-submit" disabled={busy}>
        {busy ? m.sending : m.sendReviews}
        {!busy && <Icon name="arrowOut" className="sl-arrow-out" />}
      </button>
    </form>
  );
}
