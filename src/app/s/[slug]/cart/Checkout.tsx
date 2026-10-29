"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Alert, Button, ButtonLink, Card, EmptyState, Field, IconButton, Input, ProductPhoto, QtyStepper, Select, Textarea } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CheckoutMessages } from "@/i18n/messages/checkout";
import { governorateNames } from "@/i18n/messages/store";
import { ApiError, api, errorMessage, newIdempotencyKey } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { GOVERNORATES } from "@/server/domain/lebanon";
import { checkNote } from "@/server/domain/storefront";
import { clearCart, removeLine, setQty, useCart, type CartLine } from "../../../_storefront/cart";
import type { CatalogueProduct } from "../../../_storefront/data";

type Props = {
  slug: string;
  products: CatalogueProduct[];
  currency: "USD" | "LBP";
  deliveryFeeMinor: number;
  locale: Locale;
  step: "cart" | "checkout";
  m: CheckoutMessages;
};

type Hit = { product: CatalogueProduct; variant: CatalogueProduct["variants"][number] };
type Row = { line: CartLine; hit: Hit | undefined; name: string; variant: string; problem: string | null };

const noSubscribe = () => () => {};
const backLink = "inline-flex min-h-11 items-center gap-1 text-sm font-bold text-sl-accent";
const noteBox = "whitespace-pre-wrap break-words rounded-[5px] border-s-[3px] border-sl-accent bg-sl-cat px-2.5 py-1.5 text-xs leading-relaxed";

/** The cart (step "cart") and the guest checkout form (step "checkout") over the same lines. */
export function Checkout({ slug, products, currency, deliveryFeeMinor, locale, step, m }: Props) {
  const router = useRouter();
  const { lines, count, roomFor } = useCart(slug);
  // The cart lives in localStorage: render nothing until it has been read, so an empty state never flashes.
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  // One key per visit to this form: a double tap or a retry after a timeout never makes two orders.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState(false);
  const [soldOut, setSoldOut] = useState<string[]>([]);

  const index = new Map(products.flatMap((p) => p.variants.map((v) => [v.id, { product: p, variant: v }] as const)));
  const rows: Row[] = lines.map((line) => {
    const hit = index.get(line.variantId);
    return {
      line,
      hit,
      name: hit?.product.name ?? m.lineUnavailable,
      variant: hit ? [hit.variant.size, hit.variant.colour].filter(Boolean).join(" · ") : "",
      problem: problemOf(line, hit),
    };
  });
  const blocked = rows.some((r) => r.problem);
  const subtotal = rows.reduce((sum, r) => sum + (r.hit ? r.hit.variant.priceMinor * r.line.qty : 0), 0);
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const nameOf = (variantId: string) => rows.find((r) => r.line.variantId === variantId)?.name ?? m.lineUnavailable;

  function problemOf(line: CartLine, hit: Hit | undefined): string | null {
    if (!hit) return m.lineUnavailable;
    if (!hit.variant.inStock || soldOut.includes(line.variantId)) return m.lineSoldOut;
    const custom = hit.product.customization;
    const check = custom ? checkNote(custom, line.note) : null;
    if (check?.ok === false) {
      return check.code === "CUSTOMIZATION_REQUIRED"
        ? fill(m.lineNoteMissing, { label: custom!.label })
        : fill(m.lineNoteTooLong, { max: custom!.maxLength });
    }
    return null;
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
    setPhoneError(false);
    try {
      // The server normalises the phone to E.164 (default Lebanon) and checks every note again.
      const res = await api<{ token: string }>(`/api/public/shops/${slug}/orders`, {
        headers: { "idempotency-key": idempotencyKey },
        body: {
          items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty, note: l.note ?? null })),
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
      setPlaced(true);
      clearCart(slug);
      router.push(`/t/${res.token}?placed=1`);
      return; // stay busy while the confirmation loads
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      const details = (err instanceof ApiError ? err.details : undefined) as
        | { variantId?: string; variantIds?: string[]; maxLength?: number; path?: string }[]
        | { variantId?: string; variantIds?: string[]; maxLength?: number }
        | undefined;
      const one = Array.isArray(details) ? undefined : details;
      if (code === "OUT_OF_STOCK" && one?.variantId) {
        setSoldOut((ids) => [...ids, one.variantId!]);
        setError(fill(m.errSoldOut, { item: nameOf(one.variantId) }));
        router.refresh();
      } else if (code === "UNAVAILABLE" && one?.variantIds) {
        setSoldOut((ids) => [...ids, ...one.variantIds!]);
        setError(fill(m.errUnavailable, { items: one.variantIds.map(nameOf).join(", ") }));
        router.refresh();
      } else if (code === "CUSTOMIZATION_REQUIRED" && one?.variantId) {
        setError(fill(m.errNoteRequired, { item: nameOf(one.variantId) }));
      } else if (code === "NOTE_TOO_LONG" && one?.variantId) {
        setError(fill(m.errNoteTooLong, { item: nameOf(one.variantId), max: one.maxLength ?? 0 }));
      } else if (Array.isArray(details) && details.some((d) => d.path === "customer.phone")) {
        setPhoneError(true);
      } else if (err instanceof ApiError && err.status === 429) {
        setError(m.errRateLimited);
      } else {
        setError(errorMessage(err, m.error));
      }
    }
    setBusy(false);
  }

  if (!mounted || placed) {
    return (
      <p role="status" className="py-20 text-center text-sm text-sl-muted">
        {placed ? m.placing : null}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="sl-heading mb-4 text-[28px] leading-tight">{m.cartTitle}</h1>
        <EmptyState
          title={m.cartEmpty}
          body={m.cartEmptyBody}
          action={<ButtonLink href={`/s/${slug}/shop`}>{m.browseShop}</ButtonLink>}
        />
      </div>
    );
  }

  const totals = (
    <dl className="flex flex-col gap-2 text-sm">
      <Line label={m.subtotal} value={money(subtotal)} />
      <Line label={m.deliveryFee} value={deliveryFeeMinor === 0 ? m.free : money(deliveryFeeMinor)} />
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-sl-border pt-3 text-base font-extrabold">
        <dt>{m.total}</dt>
        <dd className="tabular-nums">{money(subtotal + deliveryFeeMinor)}</dd>
      </div>
    </dl>
  );

  if (step === "cart") {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="sl-heading text-[28px] leading-tight">{m.cartTitle}</h1>
        <p className="mt-1 text-sm text-sl-muted">{fill(m.cartItems, { n: count })}</p>
        <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_340px] md:items-start">
          <ul className="divide-y divide-sl-border rounded-sl-lg border border-sl-border bg-sl-panel px-4 shadow-[0_2px_10px_#00000006]">
            {rows.map((r) => (
              <li key={`${r.line.variantId}:${r.line.note ?? ""}`} className="flex gap-3 py-4">
                <Thumb url={r.hit?.product.images[0]?.url} name={r.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {r.hit ? (
                        <Link href={`/s/${slug}/p/${r.hit.product.id}`} className="font-bold leading-snug hover:underline">
                          {r.name}
                        </Link>
                      ) : (
                        <span className="font-bold leading-snug">{r.name}</span>
                      )}
                      {r.hit && (
                        <p className="mt-0.5 text-xs text-sl-muted">
                          {r.variant && `${r.variant} · `}
                          <bdi>{fill(m.each, { price: money(r.hit.variant.priceMinor) })}</bdi>
                        </p>
                      )}
                    </div>
                    <IconButton
                      label={fill(m.removeItem, { item: r.name })}
                      icon="x"
                      onClick={() => removeLine(slug, r.line.variantId, r.line.note)}
                    />
                  </div>
                  {r.line.note && <NoteLine label={r.hit?.product.customization?.label} note={r.line.note} className="mt-2" />}
                  {r.problem && <p className="mt-2 text-xs font-semibold text-sl-danger">{r.problem}</p>}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    {r.hit && !r.problem ? (
                      <QtyStepper
                        shape="square"
                        value={r.line.qty}
                        min={1}
                        max={r.line.qty + roomFor(r.line.variantId)}
                        onChange={(n) => setQty(slug, r.line.variantId, r.line.note, n)}
                        locale={locale}
                        label={r.name}
                      />
                    ) : (
                      <span />
                    )}
                    <span className="font-extrabold tabular-nums">{r.hit ? money(r.hit.variant.priceMinor * r.line.qty) : null}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Card className="flex flex-col gap-4 rounded-[14px] p-5 md:sticky md:top-20">
            {totals}
            <p className="text-xs leading-normal text-sl-muted">{m.cartNote}</p>
            {blocked && <Alert tone="warning">{m.fixCart}</Alert>}
            <ButtonLink
              href={`/s/${slug}/cart?step=checkout`}
              block
              className="min-h-12 text-[15px]"
              aria-disabled={blocked || undefined}
              tabIndex={blocked ? -1 : undefined}
            >
              {m.toCheckout}
              <Icon name="arrow" className="size-4" />
            </ButtonLink>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/s/${slug}/cart`} className={backLink}>
        <Icon name="back" className="size-4" />
        {m.backToCart}
      </Link>
      <h1 className="sl-heading text-[28px] leading-tight">{m.checkoutTitle}</h1>
      <p className="mt-1 text-sm text-sl-muted">{m.checkoutLead}</p>
      <form onSubmit={submit} className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_360px] md:items-start">
        <Card className="flex flex-col gap-4 rounded-[14px] p-5">
          <h2 className="text-base font-bold">{m.deliveryInfo}</h2>
          <Field label={m.name}>
            <Input name="name" required maxLength={80} autoComplete="name" />
          </Field>
          <Field label={m.phone} hint={m.phoneHint} error={phoneError ? m.phoneInvalid : undefined}>
            <Input
              name="phone"
              type="tel"
              required
              defaultValue="+961 "
              autoComplete="tel"
              inputMode="tel"
              dir="ltr"
              className="rtl:text-end"
              aria-invalid={phoneError || undefined}
              onChange={() => setPhoneError(false)}
            />
          </Field>
          <Field label={`${m.email} (${m.optional})`} hint={m.emailHint}>
            <Input name="email" type="email" maxLength={200} autoComplete="email" dir="ltr" className="rtl:text-end" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
          <Field label={m.area}>
            <Input name="area" required maxLength={80} autoComplete="address-level2" />
          </Field>
          <Field label={m.street}>
            <Input name="street" required maxLength={120} autoComplete="address-line1" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${m.building} (${m.optional})`}>
              <Input name="building" maxLength={40} />
            </Field>
            <Field label={`${m.floor} (${m.optional})`}>
              <Input name="floor" maxLength={10} />
            </Field>
          </div>
          <Field label={`${m.landmark} (${m.optional})`} hint={m.landmarkHint}>
            <Input name="landmark" maxLength={200} />
          </Field>
          <Field label={`${m.notes} (${m.optional})`}>
            <Textarea name="notes" maxLength={500} />
          </Field>
        </Card>

        <Card className="flex flex-col gap-4 rounded-[14px] p-5 md:sticky md:top-20">
          <h2 className="text-base font-bold">{m.reviewItems}</h2>
          <ul className="rounded-sl bg-sl-cat px-3">
            {rows.map((r) => (
              <li
                key={`${r.line.variantId}:${r.line.note ?? ""}`}
                className="flex justify-between gap-3 border-b border-sl-border py-2.5 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <span className="font-bold">{r.name}</span>
                  <span className="text-sl-muted">
                    {r.variant && ` · ${r.variant}`} × {r.line.qty}
                  </span>
                  {r.line.note && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-sl-muted">
                      {r.hit?.product.customization?.label && <strong className="text-sl-fg">{r.hit.product.customization.label}: </strong>}
                      {r.line.note}
                    </p>
                  )}
                  {r.problem && <p className="mt-1 text-xs font-semibold text-sl-danger">{r.problem}</p>}
                </div>
                <span className="shrink-0 font-bold tabular-nums">{r.hit ? money(r.hit.variant.priceMinor * r.line.qty) : null}</span>
              </li>
            ))}
          </ul>
          <dl className="text-sm">
            <Line label={m.payment} value={<span className="font-bold">{m.cod}</span>} />
          </dl>
          {totals}
          {blocked && (
            <Alert tone="warning">
              {m.fixCart}{" "}
              <Link href={`/s/${slug}/cart`} className="font-bold underline underline-offset-2">
                {m.backToCart}
              </Link>
            </Alert>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" block className="min-h-12 text-[15px]" disabled={busy || blocked}>
            {busy ? m.placing : m.placeOrder}
          </Button>
        </Card>
      </form>
    </div>
  );
}

function Line({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sl-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function Thumb({ url, name }: { url: string | undefined; name: string }) {
  return (
    <span className="size-[72px] shrink-0 overflow-hidden rounded-sl">
      <ProductPhoto src={url} name={name} />
    </span>
  );
}

/** The customer's personal note on a line ("Engraving: Maya"), as in the mockup's cart. */
function NoteLine({ label, note, className }: { label?: string | null; note: string; className?: string }) {
  return (
    <p className={`${noteBox} ${className ?? ""}`}>
      {label && <strong>{label}: </strong>}
      {note}
    </p>
  );
}
