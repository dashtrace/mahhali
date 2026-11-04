"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import { ArrowOut, Icon } from "@/components/Icon";
import { IconButton } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { storeMessages } from "@/i18n/messages/store";

type Slide = { id: string; imageUrl: string; kicker: string | null; title: string; body: string | null };

const AUTO_MS = 5000;
const HOLD_MS = 8500; // after a marker, an arrow or a swipe, the visitor is in control for a while
const SWIPE_PX = 40;

/**
 * The home page hero under the overlaid header: full-width photos with their text
 * on a fixed scrim, so white text holds on any image. 1 slide is static; 2+ crossfade
 * every 5 s with markers, arrows, swipe and a pause button. Auto-advance stops for
 * reduced motion, a hidden tab, a mouse over the controls or keyboard focus inside,
 * and for a while after a manual change. Sizes are in globals.css, which keeps the
 * arrows clear of the WhatsApp button.
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
      className="sl-hero [&_:focus-visible]:outline-white"
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
          className="sl-fade sl-hero-photo"
        />
      ))}
      <div aria-hidden className="sl-hero-scrim" />
      <div className="sl-hero-copy">
        {/* Stacked in one grid cell: the tallest slide sets the height, so nothing jumps as they fade. */}
        <div className="grid">
          {slides.map((s, i) => (
            <div key={s.id} data-active={i === index} aria-hidden={i !== index} className="sl-hero-slide">
              {s.kicker && <p className="sl-eyebrow">{s.kicker}</p>}
              <h2 className="sl-hero-title">{s.title}</h2>
              {s.body && <p className="sl-hero-body">{s.body}</p>}
            </div>
          ))}
        </div>
        <Link href={shopHref} className="sl-hero-cta">
          {m.shopNow}
          <ArrowOut />
        </Link>
      </div>
      <div aria-hidden className="sl-scroll-note">
        {m.scrollNote}
      </div>
      {count > 1 && (
        // Only over the controls and only for a mouse: the hero fills the screen, and a tap fires mouse events with no leave.
        <div
          className="sl-hero-controls"
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") paused.current = true;
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") paused.current = false;
          }}
        >
          <div role="group" aria-label={m.heroDots} className="sl-hero-bars">
            {slides.map((s, i) => (
              <button key={s.id} type="button" aria-label={fill(m.heroDot, { n: i + 1 })} aria-current={i === index} data-running={!stopped} onClick={() => go(i)}>
                <span />
              </button>
            ))}
          </div>
          <div className="sl-hero-arrows">
            {/* Nothing rotates under reduced motion, so there is nothing to pause. */}
            <IconButton
              label={stopped ? m.heroPlay : m.heroPause}
              icon={<Icon name={stopped ? "play" : "pause"} />}
              onClick={() => {
                paused.current = false;
                setStopped(!stopped);
              }}
              className="sl-round motion-reduce:hidden"
            />
            <IconButton label={m.heroPrev} icon="back" onClick={() => go(index - 1)} className="sl-round" />
            <IconButton label={m.heroNext} icon="next" onClick={() => go(index + 1)} className="sl-round" />
          </div>
        </div>
      )}
    </section>
  );
}

/** The hero for a shop with no slides yet: its name and tagline on the themed band, so the home page still leads with one. */
function BrandHero({ shopHref, shopName, tagline, locale }: { shopHref: string; shopName: string; tagline?: string | null; locale: Locale }) {
  const m = storeMessages[locale];
  return (
    <section aria-label={fill(m.heroRegion, { name: shopName })} className="sl-hero sl-hero-band [&_:focus-visible]:outline-sl-band-ink">
      <div className="sl-hero-copy">
        <p className="sl-eyebrow">{m.heroWelcome}</p>
        <h2 className="sl-hero-title">{shopName}</h2>
        <p className="sl-hero-body">{tagline || m.heroFallbackBody}</p>
        <Link href={shopHref} className="sl-hero-cta">
          {m.shopNow}
          <ArrowOut />
        </Link>
      </div>
    </section>
  );
}
