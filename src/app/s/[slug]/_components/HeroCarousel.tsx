"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import { Icon } from "@/components/Icon";
import { ButtonLink, IconButton, cx } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { storeMessages } from "@/i18n/messages/store";

type Slide = { id: string; imageUrl: string; kicker: string | null; title: string; body: string | null };

const AUTO_MS = 5000;
const HOLD_MS = 8500; // after a marker, an arrow or a swipe, the visitor is in control for a while
const SWIPE_PX = 40;

const kickerText = "mb-2 text-[11px] font-bold uppercase tracking-[0.15em] rtl:tracking-normal";
const titleText = "sl-heading mb-3 line-clamp-3 break-words text-4xl leading-[1.1] md:text-6xl";
const bodyText = "line-clamp-3 max-w-xl text-sm leading-relaxed md:text-base";
const cta = "mt-5 min-h-12 px-6";
const control = "rounded-full border-white/60 bg-white/10 text-white";

/**
 * The home page hero under the overlaid header: full-width photos with their text
 * on a fixed scrim, so white text holds on any image. 1 slide is static; 2+ crossfade
 * every 5 s with markers, arrows, swipe and a pause button. Auto-advance stops for
 * reduced motion, a hidden tab, a mouse over the controls or keyboard focus inside,
 * and for a while after a manual change. The controls keep to the start side, clear of the WhatsApp button.
 */
export function HeroCarousel({
  slides,
  shopHref,
  shopName,
  tagline,
  locale,
}: {
  slides: Slide[];
  shopHref: string;
  shopName: string;
  tagline?: string | null;
  locale: Locale;
}) {
  const m = storeMessages[locale];
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(false);
  const holdUntil = useRef(0);
  const paused = useRef(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  useEffect(() => {
    if (count < 2 || stopped) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const id = setInterval(() => {
      if (reduced.matches || document.hidden || paused.current || Date.now() < holdUntil.current) return;
      setIndex((i) => (i + 1) % count);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [count, stopped]);

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

  if (count === 0) return <BrandHero shopHref={shopHref} shopName={shopName} tagline={tagline} locale={locale} />;
  return (
    <section
      aria-roledescription="carousel"
      aria-label={fill(m.heroRegion, { name: shopName })}
      className="relative flex h-[min(960px,100svh)] min-h-[630px] touch-pan-y flex-col justify-end overflow-hidden bg-sl-band text-white [&_:focus-visible]:outline-white"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={onTouchEnd}
      // Keyboard only: a tap also focuses the button, and would stop the rotation until the next tap elsewhere.
      onFocus={(e) => {
        if (e.target.matches(":focus-visible")) paused.current = true;
      }}
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
          className="sl-fade pointer-events-none absolute inset-0 size-full object-cover"
        />
      ))}
      {/* In px from the bottom, like the text: the block reaches about 505px at most, on any hero height. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,#000000d1,#0000008c_520px,#0000_760px)]" />
      <div className="relative mx-auto w-full max-w-6xl px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:px-4">
        {/* Stacked in one grid cell: the tallest slide sets the height, so nothing jumps as they fade. */}
        <div className="grid">
          {slides.map((s, i) => (
            <div key={s.id} data-active={i === index} aria-hidden={i !== index} className="sl-fade self-end [grid-area:1/1]">
              {s.kicker && <p className={kickerText}>{s.kicker}</p>}
              <h2 className={titleText}>{s.title}</h2>
              {s.body && <p className={bodyText}>{s.body}</p>}
            </div>
          ))}
        </div>
        <ButtonLink href={shopHref} className={cta}>
          {m.shopNow}
          <Icon name="arrow" className="size-3.5" />
        </ButtonLink>
        {count > 1 && (
          // Only over the controls and only for a mouse: the hero fills the screen, and a tap fires mouse events with no leave.
          <div
            className="mt-5 flex w-fit flex-col gap-2"
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") paused.current = true;
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") paused.current = false;
            }}
          >
            <div role="group" aria-label={m.heroDots} className="flex max-w-xs gap-1.5">
              {slides.map((s, i) => (
                <button key={s.id} type="button" aria-label={fill(m.heroDot, { n: i + 1 })} aria-current={i === index} onClick={() => go(i)} className="group h-7 flex-1">
                  <span className="block h-[3px] rounded-full bg-white/40 transition-colors group-aria-[current=true]:bg-white" />
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <IconButton label={m.heroPrev} icon="back" onClick={() => go(index - 1)} className={control} />
              <IconButton label={m.heroNext} icon="next" onClick={() => go(index + 1)} className={control} />
              {/* Nothing rotates under reduced motion, so there is nothing to pause. */}
              <IconButton
                label={stopped ? m.heroPlay : m.heroPause}
                icon={stopped ? "play" : "pause"}
                onClick={() => {
                  paused.current = false;
                  setStopped(!stopped);
                }}
                className={cx(control, "motion-reduce:hidden")}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** The hero for a shop with no slides yet: its name and tagline on the themed band, so the home page still leads with one. */
function BrandHero({ shopHref, shopName, tagline, locale }: { shopHref: string; shopName: string; tagline?: string | null; locale: Locale }) {
  const m = storeMessages[locale];
  return (
    <section
      aria-label={fill(m.heroRegion, { name: shopName })}
      className="flex min-h-[440px] flex-col justify-end bg-sl-band text-sl-band-ink [&_:focus-visible]:outline-sl-band-ink md:min-h-[520px]"
    >
      <div className="mx-auto w-full max-w-6xl px-5 pb-10 pt-24 md:px-4">
        <p className={kickerText}>{m.heroWelcome}</p>
        <h2 className={titleText}>{shopName}</h2>
        <p className={bodyText}>{tagline || m.heroFallbackBody}</p>
        {/* The band's own pair: a primary button has no contrast guarantee against the band. */}
        <ButtonLink href={shopHref} className={cx(cta, "bg-sl-band-ink text-sl-band")}>
          {m.shopNow}
          <Icon name="arrow" className="size-3.5" />
        </ButtonLink>
      </div>
    </section>
  );
}
