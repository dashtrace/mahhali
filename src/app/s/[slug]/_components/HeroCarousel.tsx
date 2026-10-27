"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import { Icon } from "@/components/Icon";
import { ButtonLink } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { storeMessages } from "@/i18n/messages/store";

type Slide = { id: string; imageUrl: string; kicker: string | null; title: string; body: string | null };

const AUTO_MS = 5000;
const HOLD_MS = 8500; // after a dot or a swipe, the visitor is in control for a while
const SWIPE_PX = 40;

/**
 * The home page promo carousel: 1 slide is static, 2+ crossfade every 5 s with
 * dots and swipe. Auto-advance stops for reduced motion, a hidden tab, hover or
 * keyboard focus inside, and for a while after a manual change.
 */
export function HeroCarousel({
  slides,
  shopHref,
  shopName,
  tagline,
  logo,
  locale,
}: {
  slides: Slide[];
  shopHref: string;
  shopName: string;
  tagline?: string | null;
  logo?: string | null;
  locale: Locale;
}) {
  const m = storeMessages[locale];
  const [index, setIndex] = useState(0);
  const holdUntil = useRef(0);
  const paused = useRef(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  useEffect(() => {
    if (count < 2) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const id = setInterval(() => {
      if (reduced.matches || document.hidden || paused.current || Date.now() < holdUntil.current) return;
      setIndex((i) => (i + 1) % count);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [count]);

  function go(to: number) {
    setIndex((to + count) % count);
    holdUntil.current = Date.now() + HOLD_MS;
  }

  function onTouchEnd(e: TouchEvent) {
    if (touchX.current === null || count < 2) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) <= SWIPE_PX) return;
    // Swiping towards the start edge moves forward, so the direction flips in Arabic.
    const forward = locale === "ar" ? dx > 0 : dx < 0;
    go(index + (forward ? 1 : -1));
  }

  if (count === 0) return <BrandHero shopHref={shopHref} shopName={shopName} tagline={tagline} logo={logo} locale={locale} />;
  const slide = slides[index] ?? slides[0];
  return (
    <section
      aria-roledescription="carousel"
      aria-label={fill(m.heroRegion, { name: shopName })}
      className="relative mb-4 h-[235px] touch-pan-y overflow-hidden rounded-[21px] bg-sl-hero text-sl-hero-ink sm:h-72"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
    >
      {slides.map((s, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
        <img
          key={s.id}
          src={s.imageUrl}
          alt=""
          data-active={i === index}
          loading={i === 0 ? "eager" : "lazy"}
          className="sl-fade pointer-events-none absolute inset-y-0 end-0 h-full w-[56%] object-cover [mask-image:linear-gradient(to_left,black_67%,transparent)] rtl:[mask-image:linear-gradient(to_right,black_67%,transparent)]"
        />
      ))}
      <div className="relative z-[1] flex h-full w-[65%] flex-col justify-center py-4 pe-3 ps-5 sm:w-1/2 sm:ps-8">
        {slide.kicker && <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.15em] rtl:tracking-normal">{slide.kicker}</p>}
        <h2 className="sl-heading mb-2 line-clamp-2 text-[28px] leading-[1.05] sm:text-4xl">{slide.title}</h2>
        {slide.body && <p className="mb-3 line-clamp-2 max-w-[240px] text-[13px] leading-snug sm:max-w-sm sm:text-sm">{slide.body}</p>}
        <ButtonLink href={shopHref} className="self-start text-[13px]">
          {m.shopNow}
          <Icon name="arrow" className="size-3.5" />
        </ButtonLink>
      </div>
      {count > 1 && (
        // On the photo side, clear of the copy; each dot keeps a 44px hit area.
        <div role="group" aria-label={m.heroDots} className="absolute bottom-0 end-2 z-[4] flex">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={fill(m.heroDot, { n: i + 1 })}
              aria-current={i === index}
              onClick={() => go(i)}
              className="group grid size-11 place-items-center"
            >
              <span className="h-[7px] w-[7px] rounded-full bg-white/60 shadow-[0_1px_5px_#0004] transition-[width,background-color] duration-200 group-aria-[current=true]:w-[21px] group-aria-[current=true]:bg-sl-accent" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** The hero for a shop with no slides yet: its name and tagline on a themed backdrop, so the home page still leads with one. */
function BrandHero({ shopHref, shopName, tagline, logo, locale }: { shopHref: string; shopName: string; tagline?: string | null; logo?: string | null; locale: Locale }) {
  const m = storeMessages[locale];
  return (
    <section
      aria-label={fill(m.heroRegion, { name: shopName })}
      className="relative mb-4 h-[235px] overflow-hidden rounded-[21px] bg-[linear-gradient(135deg,var(--sl-hero),color-mix(in_srgb,var(--sl-accent)_30%,var(--sl-bg)))] text-sl-hero-ink sm:h-72"
    >
      <span aria-hidden className="absolute -end-12 -top-14 size-56 rounded-full bg-sl-accent opacity-15" />
      <span aria-hidden className="absolute -bottom-20 end-20 size-44 rounded-full border-[18px] border-sl-accent opacity-10" />
      <span aria-hidden className="absolute end-5 top-1/2 grid size-28 -translate-y-1/2 place-items-center overflow-hidden rounded-full bg-sl-panel/75 text-sl-accent shadow-[0_8px_30px_#0000001a] sm:end-12 sm:size-40">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
          <img src={logo} alt="" className="size-[70%] object-contain" />
        ) : (
          <Icon name="bag" className="size-12 sm:size-16" />
        )}
      </span>
      <div className="relative z-[1] flex h-full w-[62%] flex-col justify-center py-4 pe-2 ps-5 sm:w-1/2 sm:ps-8">
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.15em] text-sl-accent rtl:tracking-normal">{m.heroWelcome}</p>
        <h2 className="sl-heading mb-2 line-clamp-2 break-words text-[28px] leading-[1.05] sm:text-4xl">{shopName}</h2>
        <p className="mb-3 line-clamp-2 text-[13px] leading-snug sm:max-w-sm sm:text-sm">{tagline || m.heroFallbackBody}</p>
        <ButtonLink href={shopHref} className="self-start text-[13px]">
          {m.shopNow}
          <Icon name="arrow" className="size-3.5" />
        </ButtonLink>
      </div>
    </section>
  );
}
