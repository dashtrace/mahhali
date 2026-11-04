"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { EmailField } from "@/components/EmailField";
import { ArrowOut, Icon } from "@/components/Icon";
import { Alert, Button, ButtonLink, Field, Input, ProductPhoto, QtyStepper, Select, Textarea } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CheckoutMessages } from "@/i18n/messages/checkout";
import { common } from "@/i18n/messages/common";
import { governorateNames } from "@/i18n/messages/store";
import { ApiError, api, errorMessage, newIdempotencyKey } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { GOVERNORATES } from "@/server/domain/lebanon";
import { checkNote } from "@/server/domain/storefront";
import { clearCart, qtyOf, removeLine, setQty, useCart, type CartLine } from "../../../_storefront/cart";
import type { CatalogueProduct } from "../../../_storefront/data";
import { PageEmpty, PageHead } from "../_components/tiles";

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
      variant: hit ? hit.variant.optionValues.filter(Boolean).join(" · ") : "",
      problem: problemOf(line, hit),
    };
  });
  const blocked = rows.some((r) => r.problem);
  const subtotal = rows.reduce((sum, r) => sum + (r.hit ? r.hit.variant.priceMinor * r.line.qty : 0), 0);
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const nameOf = (variantId: string) => rows.find((r) => r.line.variantId === variantId)?.name ?? m.lineUnavailable;

  function problemOf(line: CartLine, hit: Hit | undefined): string | null {
    if (!hit) return m.lineUnavailable;
    if (!hit.variant.inStock) return m.lineSoldOut;
    // Over all lines of the variant: two notes on the same variant share its stock.
    if (qtyOf(lines, line.variantId) > hit.variant.left) return fill(m.lineOnlyLeft, { n: hit.variant.left });
    if (soldOut.includes(line.variantId)) return m.lineSoldOut;
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
      } else if (Array.isArray(details) && details.some((d) => d.path === "customer.email")) {
        // The field checks itself first; this catches what only the server knows.
        setError(common[locale].emailInvalid);
      } else if (Array.isArray(details) && details.some((d) => d.path?.startsWith("customer.") || d.path?.startsWith("address."))) {
        // A required field holding only spaces passes the browser's check and is empty once trimmed.
        setError(m.errDetails);
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
      <>
        <PageHead eyebrow={m.cartEyebrow} title={m.cartTitle} lead={fill(m.cartItems, { n: count })} />
        <PageEmpty
          title={m.cartEmpty}
          body={m.cartEmptyBody}
          action={
            <Link href={`/s/${slug}/shop`} className="sl-text-cta">
              {m.browseShop}
              <ArrowOut />
            </Link>
          }
        />
      </>
    );
  }

  const totals = (
    <dl>
      <Line label={m.subtotal} value={<b>{money(subtotal)}</b>} />
      <Line label={m.deliveryFee} value={deliveryFeeMinor === 0 ? m.free : money(deliveryFeeMinor)} />
      <div className="sl-totals-row sl-totals-final">
        <dt>{m.total}</dt>
        <dd className="tabular-nums">{money(subtotal + deliveryFeeMinor)}</dd>
      </div>
    </dl>
  );

  if (step === "cart") {
    return (
      <>
        <PageHead eyebrow={m.cartEyebrow} title={m.cartTitle} lead={fill(m.cartItems, { n: count })} />
        <div className="sl-cart-layout">
          <ul>
            {rows.map((r) => (
              <li key={`${r.line.variantId}:${r.line.note ?? ""}`} className="sl-cart-line">
                <Thumb url={r.hit?.product.images[0]?.url} name={r.name} />
                <div className="min-w-0">
                  <h3>{r.hit ? <Link href={`/s/${slug}/p/${r.hit.product.id}`}>{r.name}</Link> : r.name}</h3>
                  {r.hit && (
                    <p className="sl-cart-meta">
                      <bdi>{fill(m.each, { price: money(r.hit.variant.priceMinor) })}</bdi>
                      {` · ${r.variant || m.standard}`}
                    </p>
                  )}
                  {r.line.note && <NoteLine label={r.hit?.product.customization?.label} note={r.line.note} className="mb-2.5" />}
                  {r.problem && <p className="mb-2.5 text-xs font-semibold text-sl-danger">{r.problem}</p>}
                  <div className="sl-cart-controls">
                    {r.hit?.variant.inStock && (
                      <QtyStepper
                        shape="square"
                        className="sl-cart-qty"
                        value={r.line.qty}
                        min={1}
                        max={Math.max(1, r.line.qty + roomFor(r.line.variantId, r.hit.variant.left))}
                        onChange={(n) => {
                          setQty(slug, r.line.variantId, r.line.note, n);
                          setSoldOut((ids) => ids.filter((id) => id !== r.line.variantId));
                        }}
                        locale={locale}
                        label={r.name}
                      />
                    )}
                    <button
                      type="button"
                      aria-label={fill(m.removeItem, { item: r.name })}
                      className="sl-cart-remove"
                      onClick={() => removeLine(slug, r.line.variantId, r.line.note)}
                    >
                      {common[locale].remove}
                    </button>
                  </div>
                </div>
                <span className="sl-cart-cost tabular-nums">{r.hit ? money(r.hit.variant.priceMinor * r.line.qty) : null}</span>
              </li>
            ))}
          </ul>
          <aside className="sl-cart-summary sl-on-surface">
            <h2>{m.summaryTitle}</h2>
            {totals}
            {blocked && <Alert tone="warning" className="mt-3.5">{m.fixCart}</Alert>}
            <ButtonLink
              href={`/s/${slug}/cart?step=checkout`}
              block
              className="sl-action sl-action-text"
              aria-disabled={blocked || undefined}
              tabIndex={blocked ? -1 : undefined}
            >
              {m.toCheckout}
              <ArrowOut />
            </ButtonLink>
            <p className="sl-summary-note">{m.cartNote}</p>
          </aside>
        </div>
      </>
    );
  }

  return (
    <>
      <Link href={`/s/${slug}/cart`} className="sl-subback">
        <Icon name="arrowBack" className="size-3.5" />
        {m.backToCart}
      </Link>
      <PageHead eyebrow={m.checkoutEyebrow} title={m.checkoutTitle} lead={m.checkoutLead} />
      <form onSubmit={submit} className="sl-cart-layout">
        <div className="sl-checkout-form min-w-0">
          <h2 className="sl-section-title">{m.contactDetails}</h2>
          <Field label={m.name}>
            <Input name="name" required maxLength={80} autoComplete="name" placeholder={m.namePlaceholder} />
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
          <EmailField label={`${m.email} (${m.optional})`} hint={m.emailHint} locale={locale} />
          <h2 className="sl-section-title">{m.deliveryInfo}</h2>
          <div className="grid gap-x-3 sm:grid-cols-2">
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
            <Input name="area" required maxLength={80} autoComplete="address-level2" placeholder={m.areaPlaceholder} />
          </Field>
          <Field label={m.street}>
            <Input name="street" required maxLength={120} autoComplete="address-line1" placeholder={m.streetPlaceholder} />
          </Field>
          <div className="grid grid-cols-2 gap-x-3">
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
          <p className="sl-checkout-help">{m.cod}</p>
          {blocked && (
            <Alert tone="warning" className="mb-3.5">
              {m.fixCart}{" "}
              <Link href={`/s/${slug}/cart`} className="font-bold underline underline-offset-2">
                {m.backToCart}
              </Link>
            </Alert>
          )}
          {error && <Alert tone="error" className="mb-3.5">{error}</Alert>}
          <Button type="submit" block className="sl-action sl-action-text" disabled={busy || blocked}>
            {busy ? m.placing : m.placeOrder}
            <ArrowOut />
          </Button>
        </div>

        <aside className="sl-cart-summary sl-on-surface">
          <h2>{m.reviewItems}</h2>
          <ul>
            {rows.map((r) => (
              <li key={`${r.line.variantId}:${r.line.note ?? ""}`} className="sl-totals-row">
                <div className="min-w-0">
                  <span>
                    {r.name}
                    {r.variant && ` · ${r.variant}`} × {r.line.qty}
                  </span>
                  {r.line.note && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-sl-muted">
                      {r.hit?.product.customization?.label && <strong className="text-sl-fg">{r.hit.product.customization.label}: </strong>}
                      {r.line.note}
                    </p>
                  )}
                  {r.problem && <p className="mt-1 text-xs font-semibold text-sl-danger">{r.problem}</p>}
                  {/* Fixed here, because going back to the bag loses the typed form. */}
                  {r.problem && (
                    <button
                      type="button"
                      aria-label={fill(m.removeItem, { item: r.name })}
                      className="mt-1 py-1 text-xs font-bold underline underline-offset-2"
                      onClick={() => {
                        removeLine(slug, r.line.variantId, r.line.note);
                        setError(null);
                      }}
                    >
                      {common[locale].remove}
                    </button>
                  )}
                </div>
                <strong className="shrink-0 tabular-nums">{r.hit ? money(r.hit.variant.priceMinor * r.line.qty) : null}</strong>
              </li>
            ))}
          </ul>
          {totals}
        </aside>
      </form>
    </>
  );
}

function Line({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="sl-totals-row">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function Thumb({ url, name }: { url: string | undefined; name: string }) {
  return (
    <span className="sl-cart-thumb">
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
