"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { ShopFrame } from "@/app/_storefront/ShopFrame";
import { WishButton } from "@/app/_storefront/wishlist";
import { storeMessages } from "@/i18n/messages/store";
import type { StoreData } from "@/app/s/[slug]/_components/load";
import { ShopCatalogue } from "@/app/s/[slug]/_components/ShopCatalogue";
import { StoreHome } from "@/app/s/[slug]/_components/StoreHome";
import { PageEmpty } from "@/app/s/[slug]/_components/tiles";
import { ProductContent } from "@/app/s/[slug]/p/[id]/ProductContent";
import { PREVIEW_DRAFT, PREVIEW_READY, applyDraft, type PreviewDraft } from "./draft";

type Detail = Pick<ComponentProps<typeof ProductContent>, "reviews" | "related"> & { product: StoreData["products"][number] };
type Props = { data: StoreData; view: "home" | "shop" | "product"; listing?: ComponentProps<typeof ShopCatalogue>["listing"]; detail?: Detail };

// Controls that only change what's on screen. Every other link and button is off: it would
// leave the preview, or write to the owner's real bag and wishlist. A new control stays off until listed here.
const LOOK_ONLY = ".sl-hero-controls button, [aria-haspopup=dialog], dialog button, .sl-variant, .sl-qty button, .sl-detail-photo button, .sl-scroll-row button, .sl-price-trigger, a[href^='#']";

function block(e: Event) {
  if (e.type === "click") {
    const control = (e.target as Element).closest("a, button");
    if (!control || control.matches(LOOK_ONLY)) return;
  }
  e.preventDefault();
  e.stopPropagation();
}

/** The real storefront pages with the owner's unsaved edits on top. Only rendered inside the settings page's frame. */
export function PreviewFrame({ data, view, listing, detail }: Props) {
  const [draft, setDraft] = useState<PreviewDraft>({});

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin === location.origin && e.source === window.parent && e.data?.type === PREVIEW_DRAFT) setDraft(e.data.draft);
    }
    addEventListener("message", onMessage);
    // On window, in the capture phase: before React and next/link see the event.
    addEventListener("click", block, true);
    addEventListener("submit", block, true);
    document.documentElement.style.scrollbarWidth = "thin";
    window.parent.postMessage({ type: PREVIEW_READY }, location.origin);
    return () => {
      removeEventListener("message", onMessage);
      removeEventListener("click", block, true);
      removeEventListener("submit", block, true);
    };
  }, []);

  // The hero rotates; bring the slide being edited to the front through its own marker.
  useEffect(() => {
    if (draft.focus !== undefined) document.querySelectorAll<HTMLElement>(".sl-hero-bars button")[draft.focus]?.click();
  }, [draft]);

  const shop = applyDraft(data.shop, draft);
  const { locale, slug } = shop;

  if (view === "home") {
    return (
      <ShopFrame shop={shop} locale={locale} overlay={shop.slides.length > 0 ? "photo" : "band"}>
        <StoreHome {...data} shop={shop} />
      </ShopFrame>
    );
  }
  if (view === "shop" && listing) {
    return (
      <ShopFrame shop={shop} locale={locale} page>
        <ShopCatalogue
          slug={slug}
          shopName={shop.name}
          categories={shop.categories}
          currency={shop.currency}
          locale={locale}
          filters={{}}
          listing={listing}
          shopHasProducts={data.products.length > 0}
          collections={{ bestsellers: data.products.some((p) => p.soldCount > 0), featured: data.products.some((p) => p.featured) }}
        />
      </ShopFrame>
    );
  }
  if (detail) {
    return (
      <ShopFrame shop={shop} locale={locale} page wish={<WishButton slug={slug} productId={detail.product.id} locale={locale} variant="icon" />}>
        <ProductContent slug={slug} shop={shop} product={detail.product} reviews={detail.reviews} related={detail.related} locale={locale} />
      </ShopFrame>
    );
  }
  const m = storeMessages[locale];
  return (
    <ShopFrame shop={shop} locale={locale} page>
      <PageEmpty title={m.comingSoon} body={m.comingSoonBody} />
    </ShopFrame>
  );
}
