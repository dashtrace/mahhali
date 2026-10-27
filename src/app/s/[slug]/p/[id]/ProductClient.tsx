"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { MAX_QTY, addToCart, useCart } from "@/app/_storefront/cart";
import { Icon } from "@/components/Icon";
import { Button, ProductPhoto, QtyStepper, Textarea, cx } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { storeMessages, type StoreMessages } from "@/i18n/messages/store";
import { formatMoney } from "@/lib/format";
import type { StoreProduct } from "../../_components/load";

// The product page's interactive parts: gallery, option pills, quantity,
// customization note and the sticky Add to cart / Buy now bar. The bar lives in
// ShopFrame's bottom slot, apart from the rest, so they share state through a
// provider that wraps the whole frame.

type Product = Pick<StoreProduct, "id" | "name" | "images" | "variants" | "customization">;
type Variant = Product["variants"][number];
type Notice = { tone: "ok" | "warn"; text: string };

const SWIPE_PX = 38;
const MAX_NOTE = 500;

const variantName = (v: Variant, m: StoreMessages) => [v.size, v.colour].filter(Boolean).join(" · ") || m.standard;

function useProductState(product: Product, slug: string, locale: Locale) {
  const m = storeMessages[locale];
  const [variantId, setVariantId] = useState(() => (product.variants.find((v) => v.inStock) ?? product.variants[0])?.id);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [photo, setPhoto] = useState(0);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const { roomFor } = useCart(slug);

  const variant = product.variants.find((v) => v.id === variantId);
  const room = variant ? roomFor(variant.id) : 0;
  const custom = product.customization;
  const noteMax = custom ? Math.min(MAX_NOTE, custom.maxLength) : 0;

  /** Picking an option resets the quantity and shows that colour's photo when there is one. */
  function pick(v: Variant) {
    setVariantId(v.id);
    setQty(1);
    setNotice(null);
    const i = v.colour ? product.images.findIndex((img) => img.colour === v.colour) : -1;
    if (i >= 0) setPhoto(i);
  }

  /** Adds the selection; false when the note blocks it (the textarea gets focus). */
  function add(): boolean {
    if (!variant?.inStock) return false;
    const text = note.trim();
    if (custom?.required && !text) return blockNote(m.errCustomRequired);
    if (custom && text.length > noteMax) return blockNote(m.errCustomLong);
    setNoteError(null);
    const added = addToCart(slug, { variantId: variant.id, qty: Math.min(qty, Math.max(1, room)), note: custom ? text : undefined });
    setNotice(
      added === 0
        ? { tone: "warn", text: m.maxInCart }
        : { tone: "ok", text: fill(m.addedLine, { qty: added, name: product.name, variant: variantName(variant, m) }) },
    );
    setQty(1);
    return true;
  }

  function blockNote(message: string) {
    setNoteError(message);
    noteRef.current?.focus();
    return false;
  }

  return { product, slug, locale, m, variant, room, qty, setQty, note, setNote, noteMax, noteError, noteRef, notice, setNotice, photo, setPhoto, pick, add };
}

type ProductState = ReturnType<typeof useProductState>;
const ProductContext = createContext<ProductState | null>(null);

function useProduct() {
  const state = useContext(ProductContext);
  if (!state) throw new Error("ProductProvider is missing");
  return state;
}

export function ProductProvider({ product, slug, locale, children }: { product: Product; slug: string; locale: Locale; children: ReactNode }) {
  return <ProductContext.Provider value={useProductState(product, slug, locale)}>{children}</ProductContext.Provider>;
}

/** Main photo with next / swipe (clamped), a counter and thumbnails. */
export function Gallery() {
  const { product, m, photo, setPhoto, locale } = useProduct();
  const touchX = useRef<number | null>(null);
  const images = product.images;
  const n = images.length;
  const photoName = (i: number) => fill(m.imageAlt, { name: product.name, photo: i === 0 ? m.mainPhoto : fill(m.productPhotoN, { n: i + 1 }) });

  function onTouchEnd(e: TouchEvent) {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) <= SWIPE_PX) return;
    const forward = locale === "ar" ? dx > 0 : dx < 0;
    setPhoto(Math.min(n - 1, Math.max(0, photo + (forward ? 1 : -1))));
  }

  return (
    <section aria-label={m.galleryLabel} className="min-w-0">
      <div
        className="relative aspect-[1/0.81] touch-pan-y overflow-hidden rounded-[20px] border border-sl-border bg-sl-cat"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={onTouchEnd}
      >
        <ProductPhoto src={images[photo]?.url} name={product.name} alt={n > 0 ? photoName(photo) : ""} fit="contain" />
        {n > 1 && (
          <>
            <button
              type="button"
              onClick={() => setPhoto((photo + 1) % n)}
              className="absolute end-2.5 top-2.5 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-sl-border bg-sl-panel px-3.5 text-xs font-bold text-sl-fg"
            >
              {m.nextPhoto}
              <Icon name="arrow" className="size-3.5" />
            </button>
            <span aria-hidden className="absolute bottom-2.5 end-2.5 rounded-full bg-[#111b22bb] px-2.5 py-1 text-[11px] font-bold text-white tabular-nums" dir="ltr">
              {photo + 1} / {n}
            </span>
          </>
        )}
      </div>
      {n > 1 && (
        <ul aria-label={m.thumbsLabel} className="sl-scroll-row mt-2.5 gap-2.5 pb-1">
          {images.map((img, i) => (
            <li key={img.url} className="snap-start">
              <button
                type="button"
                aria-label={photoName(i)}
                aria-pressed={i === photo}
                onClick={() => setPhoto(i)}
                className="block h-[62px] w-16 overflow-hidden rounded-sl-sm border-2 border-transparent bg-sl-cat aria-pressed:border-sl-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is */}
                <img src={img.url} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Price, option pills, quantity, stock line and the customization note. */
export function ProductOptions({ currency }: { currency: "USD" | "LBP" }) {
  const { product, m, locale, variant, room, qty, setQty, note, setNote, noteMax, noteError, noteRef, pick } = useProduct();
  const custom = product.customization;
  const price = variant?.priceMinor ?? Math.min(...product.variants.map((v) => v.priceMinor));
  const inCart = variant ? MAX_QTY - room : 0;

  return (
    <div>
      <p className="mb-3 mt-1 text-2xl font-extrabold tabular-nums">
        <bdi>{formatMoney(price, currency, locale)}</bdi>
      </p>

      <div className="mb-2 mt-3 flex items-baseline justify-between gap-2">
        <span id="option-label" className="text-sm font-extrabold">
          {product.variants.length > 1 ? m.chooseOption : m.option}
        </span>
        <span className="text-xs text-sl-muted">{m.priceMayVary}</span>
      </div>
      <div role="group" aria-labelledby="option-label" className="flex flex-wrap gap-2">
        {product.variants.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={v.id === variant?.id}
            disabled={!v.inStock}
            onClick={() => pick(v)}
            className="flex min-h-11 min-w-[82px] flex-col items-start gap-0.5 rounded-sl border border-sl-border bg-sl-panel px-3 py-2 text-start text-xs aria-pressed:border-sl-accent aria-pressed:bg-sl-cat aria-pressed:shadow-[inset_0_0_0_1px_var(--sl-accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <strong className="text-[13px]">{variantName(v, m)}</strong>
            <small className="text-xs text-sl-muted">
              <bdi>{fill(m.variantMeta, { price: formatMoney(v.priceMinor, currency, locale), stock: v.inStock ? m.inStock : m.soldOut })}</bdi>
            </small>
          </button>
        ))}
      </div>

      <div className="mb-2 mt-4 flex flex-wrap items-center justify-between gap-3.5">
        <QtyStepper value={Math.min(qty, Math.max(1, room))} onChange={setQty} max={Math.max(1, room)} locale={locale} label={product.name} />
        <p className="text-[13px] font-bold text-sl-muted">
          {variant?.inStock ? (
            <>
              <span aria-hidden className="text-sl-ok">
                ●{" "}
              </span>
              {m.inStock}
            </>
          ) : (
            <span className="text-sl-danger">{m.outOfStock}</span>
          )}
          <span className="block text-xs font-normal">{m.forSelected}</span>
        </p>
      </div>
      {inCart > 0 && <p className="text-xs text-sl-muted">{room > 0 ? fill(m.inCartAlready, { n: inCart }) : m.maxInCart}</p>}

      {custom && (
        <section aria-labelledby="customize-title" className="mb-2 mt-4 rounded-[15px] border border-sl-accent bg-sl-panel p-3.5">
          <h2 id="customize-title" className="text-base font-bold">
            {m.customizeTitle}
          </h2>
          <p className="mb-3 mt-1 text-xs leading-normal text-sl-muted">{m.customizeHelp}</p>
          <label htmlFor="custom-note" className="mb-2 block text-[13px] font-bold">
            {custom.label}
            {custom.required ? <span aria-hidden> *</span> : <span className="font-normal text-sl-muted"> {m.customOptional}</span>}
          </label>
          <Textarea
            id="custom-note"
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, noteMax))}
            maxLength={noteMax}
            required={custom.required}
            placeholder={custom.placeholder ?? undefined}
            aria-invalid={!!noteError}
            aria-describedby="custom-note-help"
            className="max-h-48 resize-y bg-sl-bg"
          />
          <div id="custom-note-help" className="mt-1.5 flex justify-between gap-2.5 text-xs text-sl-muted">
            <span className={cx(noteError && "font-semibold text-sl-danger")}>
              {noteError ?? (custom.required ? m.customRequiredHint : m.customOptionalHint)}
            </span>
            <span className="shrink-0 tabular-nums" dir="ltr">
              {fill(m.customCounter, { n: note.length, max: noteMax })}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}

/** Add to cart (stays) and Buy now (adds, then the cart), with a toast above the bar. */
export function ProductBar() {
  const { slug, m, variant, room, notice, setNotice, add } = useProduct();
  const router = useRouter();

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(id);
  }, [notice, setNotice]);

  return (
    <>
      <div role="status" className="pointer-events-none fixed inset-x-3.5 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md">
        {notice && (
          <div
            className={cx(
              "pointer-events-auto flex items-center gap-2 rounded-sl border bg-sl-panel py-1 pe-1 ps-3.5 text-[13px] shadow-[0_10px_24px_#0000001a]",
              notice.tone === "ok" ? "border-sl-accent" : "border-sl-warn",
            )}
          >
            <span className="min-w-0 flex-1">{notice.text}</span>
            <Link href={`/s/${slug}/cart`} className="inline-flex min-h-11 shrink-0 items-center px-2 font-bold text-sl-accent">
              {m.viewCart}
            </Link>
            <button type="button" aria-label={m.dismiss} onClick={() => setNotice(null)} className="grid size-11 shrink-0 place-items-center text-sl-muted">
              <Icon name="close" className="size-4" />
            </button>
          </div>
        )}
      </div>
      <Button tone="outline" className="min-h-12 min-w-0 flex-1" disabled={!variant?.inStock || room < 1} onClick={add}>
        {variant?.inStock ? m.addToCart : m.outOfStock}
      </Button>
      <Button className="min-h-12 min-w-0 flex-1" disabled={!variant?.inStock} onClick={() => add() && router.push(`/s/${slug}/cart`)}>
        {m.buyNow}
        <Icon name="arrow" className="size-4" />
      </Button>
    </>
  );
}
