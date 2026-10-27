"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, ButtonLink, Card, EmptyState, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import { governorateNames, type StoreMessages } from "@/i18n/messages/store";
import { ApiError, api, errorMessage, newIdempotencyKey } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { GOVERNORATES } from "@/server/domain/lebanon";
import { MAX_QTY, useCart } from "../../../_storefront/cart";
import type { CatalogueProduct } from "../../../_storefront/data";

type Props = {
  slug: string;
  products: CatalogueProduct[];
  currency: "USD" | "LBP";
  deliveryFeeMinor: number | null;
  locale: Locale;
  m: StoreMessages;
  t: CommonMessages;
};

export function Checkout({ slug, products, currency, deliveryFeeMinor, locale, m, t }: Props) {
  const router = useRouter();
  const { cart, save } = useCart(slug);
  // One key per visit to this form: a double tap or a retry after a timeout never makes two orders.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soldOut, setSoldOut] = useState<string[]>([]);

  const index = new Map(products.flatMap((p) => p.variants.map((v) => [v.id, { product: p, variant: v }] as const)));
  const lines = Object.entries(cart).map(([id, qty]) => ({ id, qty, hit: index.get(id) }));
  const blocked = lines.some((l) => !l.hit || !l.hit.variant.inStock || soldOut.includes(l.id));
  const subtotal = lines.reduce((sum, l) => sum + (l.hit ? l.hit.variant.priceMinor * l.qty : 0), 0);
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const label = (id: string | undefined) => {
    const hit = id ? index.get(id) : undefined;
    return hit ? [hit.product.name, hit.variant.size, hit.variant.colour].filter(Boolean).join(" · ") : m.lineUnavailable;
  };

  function setQty(id: string, qty: number) {
    const next = { ...cart };
    if (qty > 0) next[id] = Math.min(qty, MAX_QTY);
    else delete next[id];
    save(next);
    setSoldOut((s) => s.filter((x) => x !== id || qty > 0));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    const addressLine = [s("street"), s("building") && `${m.building} ${s("building")}`, s("floor") && `${m.floor} ${s("floor")}`]
      .filter(Boolean)
      .join(", ");
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string }>(`/api/public/shops/${slug}/orders`, {
        headers: { "idempotency-key": idempotencyKey },
        body: {
          items: lines.map((l) => ({ variantId: l.id, qty: l.qty })),
          customer: { name: s("name"), phone: s("phone"), email: s("email") || null },
          address: {
            governorate: s("governorate"),
            district: s("district"),
            area: s("area"),
            addressLine,
            landmark: s("landmark") || null,
          },
          notes: s("notes") || null,
        },
      });
      save({});
      router.push(`/t/${res.token}?placed=1`);
      return; // stay busy while the confirmation loads
    } catch (err) {
      const details = err instanceof ApiError ? (err.details as { variantId?: string; variantIds?: string[] } | undefined) : undefined;
      if (err instanceof ApiError && err.code === "OUT_OF_STOCK" && details?.variantId) {
        setSoldOut((ids) => [...ids, details.variantId!]);
        setError(fill(m.errSoldOut, { item: label(details.variantId) }));
        router.refresh();
      } else if (err instanceof ApiError && err.code === "UNAVAILABLE" && details?.variantIds) {
        setSoldOut((ids) => [...ids, ...details.variantIds!]);
        setError(fill(m.errUnavailable, { items: details.variantIds.map(label).join(", ") }));
        router.refresh();
      } else if (err instanceof ApiError && err.status === 429) {
        setError(m.errRateLimited);
      } else {
        setError(errorMessage(err, t.error));
      }
    }
    setBusy(false);
  }

  if (lines.length === 0 && !busy) {
    return (
      <EmptyState
        title={m.cartEmpty}
        action={
          <ButtonLink href={`/s/${slug}`} tone="secondary">
            {m.continueShopping}
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 md:items-start">
      <section aria-labelledby="cart-title">
        <h1 id="cart-title" className="mb-3 text-2xl font-semibold">
          {m.cartTitle}
        </h1>
        <Card className="flex flex-col divide-y divide-stone-200 p-0">
          {lines.map((l) => {
            const bad = !l.hit || !l.hit.variant.inStock || soldOut.includes(l.id);
            return (
              <div key={l.id} className={cx("flex gap-3 p-3", bad && "bg-red-50")}>
                {l.hit?.product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
                  <img src={l.hit.product.images[0].url} alt="" className="size-16 shrink-0 rounded-[var(--radius)] object-cover" />
                ) : (
                  <div className="size-16 shrink-0 rounded-[var(--radius)] bg-stone-100" />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm font-medium">{label(l.id)}</span>
                  {l.hit && <span className="text-sm tabular-nums text-stone-600">{money(l.hit.variant.priceMinor)}</span>}
                  {bad && l.hit && <span className="text-xs text-red-700">{m.lineSoldOut}</span>}
                  <div className="flex items-center gap-1">
                    {l.hit && !bad && (
                      <>
                        <button type="button" aria-label={`${m.decrease}: ${label(l.id)}`} onClick={() => setQty(l.id, l.qty - 1)} className="size-11 rounded-[var(--radius)] border border-stone-300 text-lg">
                          −
                        </button>
                        <span className="w-8 text-center tabular-nums" aria-label={m.quantity}>
                          {l.qty}
                        </span>
                        <button type="button" aria-label={`${m.increase}: ${label(l.id)}`} disabled={l.qty >= MAX_QTY} onClick={() => setQty(l.id, l.qty + 1)} className="size-11 rounded-[var(--radius)] border border-stone-300 text-lg disabled:opacity-40">
                          +
                        </button>
                      </>
                    )}
                    <Button tone="ghost" className="ms-auto" onClick={() => setQty(l.id, 0)}>
                      {t.remove}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          <dl className="flex flex-col gap-1 p-3 text-sm">
            <div className="flex justify-between">
              <dt>{m.subtotal}</dt>
              <dd className="tabular-nums">{money(subtotal)}</dd>
            </div>
            {deliveryFeeMinor !== null ? (
              <>
                <div className="flex justify-between">
                  <dt>{m.deliveryFee}</dt>
                  <dd className="tabular-nums">{money(deliveryFeeMinor)}</dd>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <dt>{m.total}</dt>
                  <dd className="tabular-nums">{money(subtotal + deliveryFeeMinor)}</dd>
                </div>
              </>
            ) : (
              <p className="text-xs text-stone-500">{m.deliveryLater}</p>
            )}
          </dl>
        </Card>
      </section>

      <section aria-labelledby="checkout-title">
        <h2 id="checkout-title" className="mb-1 text-xl font-semibold">
          {m.checkoutTitle}
        </h2>
        <p className="mb-3 text-sm opacity-70">{m.payOnDelivery}</p>
        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label={m.name}>
              <Input name="name" required maxLength={80} autoComplete="name" />
            </Field>
            <Field label={m.phone} hint={m.phoneHint}>
              <Input name="phone" type="tel" required defaultValue="+961 " autoComplete="tel" inputMode="tel" dir="ltr" />
            </Field>
            <Field label={`${m.email} (${t.optional})`} hint={m.emailHint}>
              <Input name="email" type="email" maxLength={200} autoComplete="email" dir="ltr" />
            </Field>
            <Field label={m.governorate}>
              <Select name="governorate" required defaultValue="">
                <option value="" disabled>
                  {m.choose}
                </option>
                {GOVERNORATES.map((g) => (
                  <option key={g} value={g}>
                    {governorateNames[locale][g]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={m.district}>
              <Input name="district" required maxLength={60} />
            </Field>
            <Field label={m.area}>
              <Input name="area" required maxLength={80} autoComplete="address-level2" />
            </Field>
            <Field label={m.street}>
              <Input name="street" required maxLength={120} autoComplete="address-line1" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${m.building} (${t.optional})`}>
                <Input name="building" maxLength={40} />
              </Field>
              <Field label={`${m.floor} (${t.optional})`}>
                <Input name="floor" maxLength={10} />
              </Field>
            </div>
            <Field label={`${m.landmark} (${t.optional})`} hint={m.landmarkHint}>
              <Input name="landmark" maxLength={200} />
            </Field>
            <Field label={`${m.notes} (${t.optional})`}>
              <Textarea name="notes" maxLength={500} />
            </Field>
            {blocked && !error && <Alert tone="warning">{m.fixCart}</Alert>}
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" block disabled={busy || blocked}>
              {busy ? m.placing : m.placeOrder}
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
