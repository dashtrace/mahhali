import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { fill, type Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { Icon, type IconName } from "./Icon";

// The house components, drawn in the shop mockup's language: hairline borders,
// soft panels, accent-filled actions. Everything reads the sl-* tokens from
// globals.css, so the same component fits the slate dashboard and any shop theme.
// Mobile first: 44px tap targets, logical properties (ms/me/ps/pe/start/end) so
// Arabic flips cleanly. Focus rings come from the global :focus-visible rule.
// See spec-foundation.md for usage.

/**
 * Joins class names; a later class replaces an earlier one of the same kind
 * (same variants, same property group), so a caller's className beats the
 * component's defaults: cx("p-4 text-sl-fg", "p-0 text-sl-danger") → "p-0 text-sl-danger".
 */
export function cx(...classes: (string | false | null | undefined)[]) {
  const byGroup = new Map<string, string>();
  for (const c of classes.filter(Boolean).join(" ").split(/\s+/)) {
    if (!c) continue;
    const key = classGroup(c);
    byGroup.delete(key); // re-insert so the winner takes the later position
    byGroup.set(key, c);
  }
  return [...byGroup.values()].join(" ");
}

const DISPLAY = new Set(["block", "inline-block", "inline", "flex", "inline-flex", "grid", "inline-grid", "hidden", "contents"]);
const WEIGHTS = /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d)/;
const TEXT_SIZE = /^text-(xs|sm|base|lg|\d*xl|\[(\d|length:))/;
const BORDER_WIDTH = /^border(-[xytblrse])?(-\d+|-\[\d[^\]]*\])?$/;
const BG_COLOR = /^bg-(?!(linear|radial|conic|gradient|cover|contain|center|top|bottom|left|right|no-repeat|repeat|fixed|local|scroll|clip|origin|blend|none|\[(url|image:|linear-|radial-|conic-|repeating-)))/;
// Longest first, so "min-h" wins over "h" and "px" over "p".
const PREFIXES = ["min-h", "min-w", "max-w", "max-h", "size", "h", "w", "px", "py", "ps", "pe", "pt", "pb", "p", "mx", "my", "ms", "me", "mt", "mb", "m", "gap", "rounded", "shadow", "justify", "items", "opacity", "leading", "tracking"];

/** "variants|group" for one class; classes outside the known groups get a key of their own. */
function classGroup(c: string): string {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < c.length; i++) {
    if (c[i] === "[") depth++;
    else if (c[i] === "]") depth--;
    else if (c[i] === ":" && depth === 0) cut = i;
  }
  const variants = c.slice(0, cut + 1);
  const u = c.slice(cut + 1).replace(/^!|!$/g, "").replace(/^-/, "");
  let group: string = u;
  if (DISPLAY.has(u)) group = "display";
  else if (u.startsWith("[")) group = u.slice(0, u.indexOf(":")); // arbitrary property: [--tone:…]
  else if (u.startsWith("text-")) group = TEXT_SIZE.test(u) ? "text-size" : /^text-(left|right|center|start|end|justify|wrap|nowrap|balance|pretty|ellipsis|clip)/.test(u) ? u : "text-color";
  else if (u.startsWith("font-")) group = WEIGHTS.test(u) ? "font-weight" : "font-family";
  else if (u === "border" || u.startsWith("border-")) group = BORDER_WIDTH.test(u) ? u.replace(/-(\d+|\[.*\])$/, "") : /^border-(solid|dashed|dotted|double|none|collapse|separate|spacing)/.test(u) ? "border-style" : "border-color";
  else if (u.startsWith("bg-")) group = BG_COLOR.test(u) ? "bg-color" : u;
  else {
    const p = PREFIXES.find((p) => u === p || u.startsWith(p + "-"));
    // Corner/side radii (rounded-t-lg, rounded-ss-sl) stay separate from the whole-box radius.
    if (p && !(p === "rounded" && /^rounded-(s|e|t|b|l|r|ss|se|es|ee|tl|tr|bl|br)(-|$)/.test(u))) group = p;
  }
  return variants + "|" + group;
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-sl px-4 text-sm font-bold transition " +
  "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45";

const buttonTones = {
  primary: "bg-sl-accent text-sl-accent-ink hover:brightness-110 active:brightness-95",
  secondary: "border border-sl-border bg-sl-panel text-sl-fg hover:border-sl-accent",
  outline: "border border-sl-accent bg-transparent text-sl-accent hover:bg-sl-soft",
  ghost: "text-sl-fg hover:bg-sl-cat",
  danger: "bg-[#c34538] text-white hover:brightness-110",
} as const;

type Tone = keyof typeof buttonTones;

export function Button({ tone = "primary", block, className, ...props }: ComponentProps<"button"> & { tone?: Tone; block?: boolean }) {
  return <button type="button" className={cx(buttonBase, buttonTones[tone], block && "w-full", className)} {...props} />;
}

export function ButtonLink({ tone = "primary", block, className, ...props }: ComponentProps<typeof Link> & { tone?: Tone; block?: boolean }) {
  return <Link className={cx(buttonBase, buttonTones[tone], block && "w-full", className)} {...props} />;
}

const iconButtonBase =
  "relative grid size-11 shrink-0 place-items-center rounded-sl border border-sl-border bg-sl-panel text-sl-fg transition hover:brightness-95 " +
  "disabled:pointer-events-none disabled:opacity-45";

function CountBubble({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span
      aria-hidden
      className="absolute -end-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-sl-accent px-1 text-[11px] font-extrabold text-sl-accent-ink tabular-nums"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

type IconButtonOwn = { label: string; icon: IconName | ReactNode; solid?: boolean; count?: number };

/** A square icon-only button. `label` is its accessible name; `count` shows a badge (include it in the label). */
export function IconButton({ label, icon, solid, count, className, ...props }: Omit<ComponentProps<"button">, "children"> & IconButtonOwn) {
  return (
    <button type="button" aria-label={label} title={label} className={cx(iconButtonBase, className)} {...props}>
      {typeof icon === "string" ? <Icon name={icon as IconName} solid={solid} /> : icon}
      <CountBubble count={count} />
    </button>
  );
}

export function IconButtonLink({ label, icon, solid, count, className, ...props }: Omit<ComponentProps<typeof Link>, "children"> & IconButtonOwn) {
  return (
    <Link aria-label={label} title={label} className={cx(iconButtonBase, className)} {...props}>
      {typeof icon === "string" ? <Icon name={icon as IconName} solid={solid} /> : icon}
      <CountBubble count={count} />
    </Link>
  );
}

export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1.5 text-sm", className)}>
      <span className="text-[13px] font-bold text-sl-fg">{label}</span>
      {children}
      {hint && !error && <span className="text-xs leading-normal text-sl-muted">{hint}</span>}
      {error && <span className="text-xs font-semibold text-sl-danger">{error}</span>}
    </label>
  );
}

const control =
  "min-h-11 w-full rounded-sl-sm border border-sl-control bg-sl-panel px-3 text-base text-sl-fg " +
  "placeholder:text-sl-muted focus-visible:border-sl-accent disabled:opacity-60 aria-[invalid=true]:border-sl-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(control, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(control, "pe-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(control, "min-h-24 py-2.5 leading-normal", className)} {...props} />;
}

/** An accessible on/off switch (a checkbox with role="switch"); works in plain forms and controlled. */
export function Toggle({ label, hint, className, ...props }: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cx("flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm", className)}>
      <span className="min-w-0">
        <span className="block font-bold text-sl-fg">{label}</span>
        {hint && <span className="block text-xs leading-normal text-sl-muted">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" {...props} />
        <span
          aria-hidden
          className="h-6 w-11 rounded-full bg-sl-control transition peer-checked:bg-sl-accent peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sl-accent peer-disabled:opacity-50"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5"
        />
      </span>
    </label>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-sl-lg border border-sl-border bg-sl-panel p-4 shadow-[0_2px_10px_#00000006]", className)} {...props} />;
}

// Tone colours are mixed with the panel and ink, so pills read on light and dark themes.
const badgeTones = {
  neutral: "[--tone:var(--sl-muted)]",
  blue: "[--tone:#2570a9]",
  amber: "[--tone:#b9852f]",
  violet: "[--tone:#7c5cc4]",
  green: "[--tone:#3f9f70]",
  red: "[--tone:#d65a5a]",
} as const;

const toned = "bg-[color-mix(in_srgb,var(--tone)_14%,var(--sl-panel))] text-[color-mix(in_srgb,var(--tone)_62%,var(--sl-fg))]";

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof badgeTones; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap", toned, badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export const STATUS_TONES = {
  NEW: "blue",
  CONFIRMED: "violet",
  PACKED: "amber",
  OUT_FOR_DELIVERY: "amber",
  DELIVERED: "green",
  CANCELLED: "neutral",
  RETURNED: "red",
} as const;

/** A bordered pill for plain metadata (a role, a count); not interactive. */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border border-sl-border bg-sl-panel px-3 py-1 text-xs font-semibold text-sl-fg", className)}>
      {children}
    </span>
  );
}

const filterChip =
  "relative inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-sl-border bg-sl-panel px-3.5 text-[13px] text-sl-fg " +
  "after:absolute after:inset-x-0 after:-inset-y-1 hover:border-sl-accent " +
  "aria-[current=true]:border-sl-accent aria-[current=true]:bg-sl-accent aria-[current=true]:font-bold aria-[current=true]:text-sl-accent-ink " +
  "aria-pressed:border-sl-accent aria-pressed:bg-sl-accent aria-pressed:font-bold aria-pressed:text-sl-accent-ink";

/** A single-select filter pill. With `href` it is a link (aria-current), otherwise a button (aria-pressed). */
export function FilterChip({ href, selected, className, children, ...props }: { href?: string; selected?: boolean; className?: string; children: ReactNode } & Omit<ComponentProps<"button">, "children">) {
  if (href)
    return (
      <Link href={href} aria-current={selected ? "true" : undefined} className={cx(filterChip, className)}>
        {children}
      </Link>
    );
  return (
    <button type="button" aria-pressed={!!selected} className={cx(filterChip, className)} {...props}>
      {children}
    </button>
  );
}

type SegmentItem = { label: ReactNode; href?: string; onClick?: () => void; current?: boolean };

/** Tabs / segmented control. Link items get aria-current="page", button items aria-pressed. */
export function Segmented({ label, items, className }: { label: string; items: SegmentItem[]; className?: string }) {
  const item =
    "flex min-h-11 flex-1 items-center justify-center rounded-sl-sm border border-sl-border bg-sl-bg px-2 text-[13px] font-bold text-sl-muted " +
    "aria-[current=page]:border-sl-accent aria-[current=page]:bg-sl-soft aria-[current=page]:text-sl-soft-ink " +
    "aria-pressed:border-sl-accent aria-pressed:bg-sl-soft aria-pressed:text-sl-soft-ink";
  return (
    <div role="group" aria-label={label} className={cx("flex gap-1.5", className)}>
      {items.map((it, i) =>
        it.href ? (
          <Link key={i} href={it.href} aria-current={it.current ? "page" : undefined} className={item}>
            {it.label}
          </Link>
        ) : (
          <button key={i} type="button" aria-pressed={!!it.current} onClick={it.onClick} className={item}>
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, back, actions }: { title: ReactNode; subtitle?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-sl-accent hover:underline">
            <Icon name="back" className="size-4" />
            {back.label}
          </Link>
        )}
        <h1 className="sl-heading truncate text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-sl-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** A section title with an optional "View all" link on the end side. */
export function SectionHeader({ title, href, linkLabel, id, className }: { title: ReactNode; href?: string; linkLabel?: ReactNode; id?: string; className?: string }) {
  return (
    <div className={cx("mb-2.5 flex items-center justify-between gap-2", className)}>
      <h2 id={id} className="sl-heading text-[22px] leading-tight">
        {title}
      </h2>
      {href && linkLabel && (
        <Link href={href} className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap text-[13px] font-bold text-sl-accent hover:underline">
          {linkLabel}
          <Icon name="arrow" className="size-4" />
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-sl-lg border border-dashed border-sl-control px-6 py-10 text-center">
      <p className="font-bold text-sl-fg">{title}</p>
      {body && <p className="mt-1 text-sm leading-normal text-sl-muted">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

const alertTones = {
  info: "[--tone:#2570a9]",
  success: "[--tone:#3f9f70]",
  warning: "[--tone:#b9852f]",
  error: "[--tone:#d65a5a]",
} as const;

/** Status messages. `note` is the mockup's neutral callout (info-note) for owner-written text. */
export function Alert({ tone = "info", children, className }: { tone?: keyof typeof alertTones | "note"; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-sl border px-3.5 py-2.5 text-sm leading-normal",
        tone === "note"
          ? "border-transparent bg-sl-cat text-sl-fg"
          : cx(
              "border-[color-mix(in_srgb,var(--tone)_35%,var(--sl-panel))] bg-[color-mix(in_srgb,var(--tone)_9%,var(--sl-panel))] text-[color-mix(in_srgb,var(--tone)_55%,var(--sl-fg))]",
              alertTones[tone],
            ),
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-sl-muted rtl:tracking-normal">{label}</span>
      <span className="text-2xl font-extrabold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-sl-muted">{hint}</span>}
    </Card>
  );
}

/** A label/value list for detail screens. */
export function DefinitionList({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map((item, i) => (
        <div key={i} className="contents">
          <dt className="text-sl-muted">{item.label}</dt>
          <dd className="min-w-0 break-words text-sl-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Average rating as five stars, with the count beside it. `label` is the screen-reader text. */
export function Stars({ average, count, label, className }: { average: number; count?: number; label: string; className?: string }) {
  const full = Math.round(average);
  return (
    <span className={cx("inline-flex items-center gap-1 text-sm", className)}>
      <span aria-hidden className="tracking-tight text-sl-star">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= full ? undefined : "opacity-30"}>
            ★
          </span>
        ))}
      </span>
      {count !== undefined && <span aria-hidden className="tabular-nums text-sl-muted">({count})</span>}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * Which page numbers to show: first, last, current ±1, everything when 7 or
 * fewer, and the first or last three near either end; "…" fills each gap.
 */
export function pageTokens(current: number, total: number): (number | "…")[] {
  const shown = new Set([1, total, current, current - 1, current + 1]);
  if (total <= 7) for (let i = 1; i <= total; i++) shown.add(i);
  else {
    if (current <= 3) [2, 3].forEach((p) => shown.add(p));
    if (current >= total - 2) [total - 1, total - 2].forEach((p) => shown.add(p));
  }
  const pages = [...shown].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const tokens: (number | "…")[] = [];
  let previous = 0;
  for (const p of pages) {
    if (p - previous > 1) tokens.push("…");
    tokens.push(p);
    previous = p;
  }
  return tokens;
}

const pageButton =
  "inline-flex h-11 min-w-11 items-center justify-center rounded-sl-sm border border-sl-border bg-sl-panel px-2.5 text-sm font-bold text-sl-fg tabular-nums hover:border-sl-accent " +
  "aria-[current=page]:border-sl-accent aria-[current=page]:bg-sl-accent aria-[current=page]:text-sl-accent-ink";

/** Numbered page links for server-rendered lists. Renders nothing for a single page. */
export function Pagination({ page, pageCount, hrefFor, locale, summary }: { page: number; pageCount: number; hrefFor: (page: number) => string; locale: Locale; summary?: ReactNode }) {
  if (pageCount <= 1) return null;
  const t = common[locale];
  const edge = (to: number, label: string, icon: IconName, enabled: boolean) =>
    enabled ? (
      <Link href={hrefFor(to)} aria-label={label} className={pageButton}>
        <Icon name={icon} className="size-4" />
      </Link>
    ) : (
      <span aria-hidden className={cx(pageButton, "opacity-35 hover:border-sl-border")}>
        <Icon name={icon} className="size-4" />
      </span>
    );
  return (
    <nav aria-label={t.pagesNav} className="mt-5 flex flex-col items-center gap-2">
      <ul className="flex flex-wrap justify-center gap-1.5">
        <li>{edge(page - 1, t.pagePrev, "back", page > 1)}</li>
        {pageTokens(page, pageCount).map((token, i) => (
          <li key={i}>
            {token === "…" ? (
              <span aria-hidden className="inline-flex h-11 items-center px-1 text-sl-muted">
                …
              </span>
            ) : (
              <Link href={hrefFor(token)} aria-label={fill(t.pageN, { n: token })} aria-current={token === page ? "page" : undefined} className={pageButton}>
                {token}
              </Link>
            )}
          </li>
        ))}
        <li>{edge(page + 1, t.pageNext, "next", page < pageCount)}</li>
      </ul>
      {summary && <p className="text-xs text-sl-muted">{summary}</p>}
    </nav>
  );
}

/** − n + quantity control (client components: needs onChange). `label` names what is counted. */
export function QtyStepper({
  value,
  onChange,
  min = 1,
  max,
  locale,
  label,
  shape = "pill",
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max: number;
  locale: Locale;
  label?: string;
  shape?: "pill" | "square";
  className?: string;
}) {
  const t = common[locale];
  const named = (s: string) => (label ? `${s}: ${label}` : s);
  const step = cx(
    "relative grid size-9 place-items-center text-sl-fg after:absolute after:-inset-1 disabled:opacity-35",
    shape === "pill" ? "rounded-full bg-sl-cat" : "rounded-sl-sm border border-sl-border bg-sl-panel",
  );
  return (
    <div
      role="group"
      aria-label={named(t.quantity)}
      className={cx("inline-flex items-center gap-3", shape === "pill" && "rounded-full border border-sl-border bg-sl-panel p-1", className)}
    >
      <button type="button" aria-label={named(t.qtyDecrease)} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={step}>
        <Icon name="minus" className="size-4" />
      </button>
      <span aria-live="polite" className="min-w-5 text-center text-sm font-bold tabular-nums">
        {value}
      </span>
      <button type="button" aria-label={named(t.qtyIncrease)} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={step}>
        <Icon name="plus" className="size-4" />
      </button>
    </div>
  );
}

/**
 * A product photo filling its parent, or, when the product has none, a tinted
 * tile with a bag outline and the product's initial (scales with the parent).
 */
export function ProductPhoto({
  src,
  name,
  alt = "",
  fit = "cover",
  loading,
  className,
}: {
  src?: string | null;
  name: string;
  alt?: string;
  fit?: "cover" | "contain";
  loading?: "lazy" | "eager";
  className?: string;
}) {
  if (src)
    // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
    return <img src={src} alt={alt} loading={loading} className={cx("size-full", fit === "cover" ? "object-cover" : "object-contain", className)} />;
  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cx(
        "@container relative grid size-full place-items-center overflow-hidden text-sl-accent",
        "bg-[linear-gradient(145deg,var(--sl-cat),color-mix(in_srgb,var(--sl-accent)_20%,var(--sl-bg)))]",
        className,
      )}
    >
      <Icon name="bag" className="absolute size-[64%] opacity-15" />
      <span className="sl-heading relative pt-[9cqw] text-[26cqw] leading-none opacity-75">{[...name.trim()][0]?.toLocaleUpperCase() ?? ""}</span>
    </span>
  );
}

/**
 * A product tile (home strips, shop grid, wishlist). The name is a stretched
 * link covering the card; `wish` (a WishButton) and `badge` sit above it.
 * `price` comes formatted by the caller (formatMoney).
 */
export function ProductCard({
  href,
  name,
  image,
  price,
  description,
  rating,
  wish,
  badge,
  locale,
  layout = "grid",
  className,
}: {
  href: string;
  name: string;
  image?: string | null;
  price: ReactNode;
  description?: string | null;
  rating?: { average: number; count: number } | null;
  wish?: ReactNode;
  badge?: ReactNode;
  locale: Locale;
  layout?: "grid" | "strip";
  className?: string;
}) {
  const t = common[locale];
  return (
    <article
      className={cx(
        "relative flex flex-col overflow-hidden rounded-sl border border-sl-border bg-sl-panel has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-sl-accent",
        layout === "strip" ? "w-[150px] shrink-0 snap-start md:w-[200px]" : "w-full",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-sl-cat">
        <ProductPhoto src={image} name={name} loading="lazy" />
        {badge && <div className="absolute start-2 top-2 z-10">{badge}</div>}
        {wish && <div className="absolute end-1 top-1 z-10">{wish}</div>}
      </div>
      <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-2">
        <h3 className="mb-0.5 line-clamp-2 min-h-[2.5em] text-[13px] font-bold leading-tight">
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {name}
          </Link>
        </h3>
        {description && <p className="mb-1 truncate text-xs text-sl-muted">{description}</p>}
        {rating && rating.count > 0 ? (
          <Stars average={rating.average} count={rating.count} label={fill(t.ratingLabel, { n: rating.average.toFixed(1) })} className="mb-1.5 text-xs" />
        ) : (
          <span aria-hidden className="mb-1.5 h-4" />
        )}
        <div className="mt-auto flex items-center justify-between gap-2">
          {/* May wrap ("From" above the amount) in narrow cards; the caller keeps the amount itself on one line. */}
          <span className="min-w-0 text-[15px] font-extrabold leading-tight tabular-nums">{price}</span>
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-sl-accent text-sl-accent-ink">
            <Icon name="plus" className="size-4" />
          </span>
        </div>
      </div>
    </article>
  );
}

/**
 * Horizontal status steps (order tracking). `current` is the index of the step
 * reached; `tone="bad"` paints it red (failed, cancelled).
 */
export function Timeline({ steps, current, label, tone }: { steps: { label: ReactNode; date?: ReactNode; icon?: IconName }[]; current: number; label: string; tone?: "bad" }) {
  const n = steps.length;
  const edge = `${50 / n}%`;
  const reached = tone === "bad" ? "border-sl-danger bg-sl-danger text-white" : "border-sl-accent bg-sl-accent text-sl-accent-ink";
  return (
    <div className="relative">
      <span aria-hidden className="absolute top-[17px] h-[3px] bg-sl-border" style={{ insetInlineStart: edge, insetInlineEnd: edge }} />
      <span
        aria-hidden
        className={cx("absolute top-[17px] h-[3px]", tone === "bad" ? "bg-sl-danger" : "bg-sl-accent")}
        style={{ insetInlineStart: edge, width: `${(Math.max(0, current) * 100) / n}%` }}
      />
      <ol aria-label={label} className="relative grid gap-0.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => (
          <li key={i} aria-current={i === current ? "step" : undefined} className="relative min-w-0 text-center">
            <span
              className={cx(
                "mx-auto mb-2 grid size-9 place-items-center rounded-full border-2",
                i < current ? "border-sl-accent bg-sl-accent text-sl-accent-ink" : i === current ? reached : "border-sl-border bg-sl-panel text-sl-muted",
                i === current && "shadow-[0_0_0_4px_color-mix(in_srgb,var(--sl-accent)_16%,transparent)]",
              )}
            >
              <Icon name={i < current ? "check" : (s.icon ?? "check")} className="size-[18px]" />
            </span>
            <span className={cx("block break-words text-[11px] font-bold leading-tight sm:text-xs", i === current && (tone === "bad" ? "text-sl-danger" : "text-sl-accent"))}>
              {s.label}
            </span>
            {s.date && <span className="mt-0.5 block text-[11px] leading-tight text-sl-muted">{s.date}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
