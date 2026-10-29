import { Icon, type IconName } from "@/components/Icon";
import { Stars, cx } from "@/components/ui";
import { dirOf, type Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { formatMoney } from "@/lib/format";
import { PALETTES, type Theme } from "@/server/domain/theme";
import { themeTone, themeVars } from "../_server/theme";

// Two drawn phones for the landing hero: the demo shops' catalogue, laid out like
// the real storefront and coloured by the real theme tokens (themeVars + .sl-shop).
// Shop content stays in each shop's own language, like a real storefront.

type Sample = {
  lang: Locale;
  theme: Theme;
  name: string;
  tagline: string;
  kicker: string;
  title: string;
  categories: string[];
  products: { name: string; desc: string; minor: number; rating?: number; count?: number }[];
  currency: "USD" | "LBP";
};

const SAMPLES: Sample[] = [
  {
    lang: "en",
    theme: PALETTES.rose,
    name: "Beirut Threads",
    tagline: "Made in Lebanon",
    kicker: "New season",
    title: "Linen for summer evenings",
    categories: ["Clothing", "Accessories"],
    currency: "USD",
    products: [
      { name: "Linen shirt", desc: "Breathable Lebanese linen", minor: 3500, rating: 5, count: 3 },
      { name: "Cedar tote bag", desc: "Heavy cotton canvas", minor: 1800, rating: 5, count: 1 },
      { name: "Beirut 961 tee", desc: "Organic cotton tee", minor: 1500, rating: 4, count: 2 },
    ],
  },
  {
    lang: "ar",
    theme: PALETTES.night,
    name: "زعتر وزيت",
    tagline: "من الجنوب إلى بابك",
    kicker: "موسم القطاف",
    title: "زعتر بلدي طازج",
    categories: ["زعتر", "زيت", "مونة"],
    currency: "LBP",
    products: [
      { name: "زعتر بلدي", desc: "مطحون مع السماق والسمسم", minor: 450_000, rating: 5, count: 4 },
      { name: "زيت زيتون بكر", desc: "عصرة أولى من الكورة", minor: 1_200_000 },
    ],
  },
];

const TABS: { icon: IconName; key: "navHome" | "navShop" | "navTrack" | "navCart" }[] = [
  { icon: "home", key: "navHome" },
  { icon: "bag", key: "navShop" },
  { icon: "box", key: "navTrack" },
  { icon: "cart", key: "navCart" },
];

function Phone({ s, className }: { s: Sample; className?: string }) {
  const t = common[s.lang];
  const st = storeMessages[s.lang];
  // A glyph, not <Icon name="arrow">: Tailwind's rtl: variant would flip it in an
  // English phone shown on an Arabic page.
  const arrow = s.lang === "ar" ? "←" : "→";
  return (
    <div className={cx("w-[248px] shrink-0 rounded-[40px] border border-[#202426] bg-[#101010] p-[7px] shadow-[0_22px_50px_#1b253033,0_1px_2px_#0009]", className)}>
      <div
        lang={s.lang}
        dir={dirOf(s.lang)}
        data-tone={themeTone(s.theme)}
        style={{ ...themeVars(s.theme), fontFamily: "var(--font-shop)" }}
        className="sl-shop relative h-[500px] overflow-hidden rounded-[33px] bg-sl-bg text-sl-fg"
      >
        <span className="absolute inset-x-0 top-2 z-10 mx-auto h-[18px] w-[72px] rounded-full bg-[#090a0b]" />
        <div className="flex items-center justify-between gap-1.5 px-3 pb-2 pt-9">
          <span className="grid size-8 place-items-center rounded-sl border border-sl-border bg-sl-panel">
            <Icon name="menu" className="size-4" />
          </span>
          <span className="min-w-0 text-center">
            <span className="sl-heading block truncate text-[15px] leading-none">{s.name}</span>
            <span className="mt-1 block truncate text-[7px] font-bold uppercase tracking-[0.18em] text-sl-muted rtl:tracking-normal">{s.tagline}</span>
          </span>
          <span className="grid size-8 place-items-center rounded-sl border border-sl-border bg-sl-panel">
            <Icon name="heart" className="size-4" />
          </span>
        </div>

        <div className="relative mx-2.5 mb-3 h-[110px] overflow-hidden rounded-[16px] bg-sl-hero p-3 text-sl-hero-ink">
          <span className="absolute -end-6 -top-4 size-28 rounded-full bg-sl-accent opacity-15" />
          <span className="absolute -bottom-8 end-6 size-20 rounded-full bg-sl-accent opacity-25" />
          <Icon name="bag" className="absolute bottom-7 end-4 size-12 text-sl-accent" />
          <div className="relative w-[64%]">
            <p className="text-[6.5px] font-extrabold uppercase tracking-[0.2em] rtl:tracking-normal">{s.kicker}</p>
            <p className="sl-heading mt-1 text-[17px] leading-[1.05]">{s.title}</p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-sl bg-sl-accent px-2.5 py-1.5 text-[8.5px] font-bold text-sl-accent-ink">
              {st.shopNow}
              <span aria-hidden>{arrow}</span>
            </span>
          </div>
          <span className="absolute bottom-2.5 end-3 flex gap-1">
            <span className="h-[5px] w-3.5 rounded-full bg-sl-accent" />
            <span className="size-[5px] rounded-full bg-white/70" />
            <span className="size-[5px] rounded-full bg-white/70" />
          </span>
        </div>

        <div className="mb-3 flex gap-3 px-3">
          {s.categories.map((c) => (
            <span key={c} className="w-11 text-center">
              <span className="sl-heading mx-auto mb-1 grid size-9 place-items-center rounded-full border border-sl-border bg-sl-cat text-[13px] text-sl-accent">{c.slice(0, 1)}</span>
              <span className="block truncate text-[7.5px]">{c}</span>
            </span>
          ))}
        </div>

        <div className="mb-2 flex items-center justify-between px-3">
          <span className="sl-heading text-[15px]">{st.sectionBestsellers}</span>
          <span className="inline-flex items-center gap-1 text-[8px] font-bold text-sl-accent">
            {t.viewAll}
            <span aria-hidden>{arrow}</span>
          </span>
        </div>
        <div className="flex gap-2 ps-3">
          {s.products.map((p) => (
            <span key={p.name} className="w-[100px] shrink-0 overflow-hidden rounded-sl border border-sl-border bg-sl-panel">
              <span className="relative grid h-[70px] place-items-center bg-sl-cat text-sl-accent">
                <Icon name="bag" className="size-9 opacity-40" />
                <span className="sl-heading absolute pt-2 text-[13px]">{p.name.slice(0, 1)}</span>
                <span className="absolute end-1 top-1 grid size-5 place-items-center rounded-full bg-sl-panel text-sl-fg">
                  <Icon name="heart" className="size-2.5" />
                </span>
              </span>
              <span className="block px-1.5 pb-1.5 pt-1">
                <span className="block truncate text-[8.5px] font-bold">{p.name}</span>
                <span className="block truncate text-[7px] text-sl-muted">{p.desc}</span>
                {p.rating ? <Stars average={p.rating} count={p.count} label="" className="text-[7px]" /> : <span className="block h-[11px]" />}
                <span className="mt-0.5 flex items-center justify-between gap-1">
                  <bdi dir="ltr" className="truncate text-[9px] font-extrabold tabular-nums">
                    {formatMoney(p.minor, s.currency, s.lang)}
                  </bdi>
                  <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-sl-accent text-sl-accent-ink">
                    <Icon name="plus" className="size-2.5" />
                  </span>
                </span>
              </span>
            </span>
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-0 flex justify-around border-t border-sl-border bg-sl-nav px-2 pb-4 pt-2">
          {TABS.map((tab, i) => (
            <span key={tab.key} className={cx("flex flex-col items-center gap-0.5 text-[7.5px]", i === 0 ? "font-extrabold text-sl-accent" : "text-sl-muted")}>
              <Icon name={tab.icon} className="size-3.5" />
              {t[tab.key]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The hero visual: a light English shop in front, a dark Arabic shop behind. */
export function StorefrontPreview({ label, captions }: { label: string; captions: [string, string] }) {
  return (
    <figure role="img" aria-label={label} className="relative mx-auto h-[560px] w-full max-w-[420px]">
      <Phone s={SAMPLES[1]} className="absolute end-0 top-6 rotate-[4deg] rtl:-rotate-[4deg]" />
      <Phone s={SAMPLES[0]} className="absolute start-0 top-0 -rotate-[2deg] rtl:rotate-[2deg]" />
      <figcaption aria-hidden className="absolute inset-x-0 bottom-0 flex justify-between gap-2 text-[11px] font-bold">
        {captions.map((c) => (
          <span key={c} className="rounded-full border border-sl-border bg-sl-panel px-2.5 py-1 text-sl-muted shadow-[0_2px_10px_#12203108]">
            {c}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
