import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// The house components. Mobile first: 44px tap targets, full-width forms,
// logical properties (ms/me/ps/pe/start/end) so Arabic flips cleanly.

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] px-4 text-sm font-medium transition " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:opacity-50 disabled:pointer-events-none";

const buttonTones = {
  primary: "bg-[var(--brand)] text-[var(--brand-ink)] hover:brightness-110 active:brightness-95",
  secondary: "border border-stone-300 bg-white text-stone-900 hover:bg-stone-50",
  ghost: "text-stone-700 hover:bg-stone-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
} as const;

type Tone = keyof typeof buttonTones;

export function Button({ tone = "primary", block, className, ...props }: ComponentProps<"button"> & { tone?: Tone; block?: boolean }) {
  return <button type="button" className={cx(buttonBase, buttonTones[tone], block && "w-full", className)} {...props} />;
}

export function ButtonLink({ tone = "primary", block, className, ...props }: ComponentProps<typeof Link> & { tone?: Tone; block?: boolean }) {
  return <Link className={cx(buttonBase, buttonTones[tone], block && "w-full", className)} {...props} />;
}

export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1.5 text-sm", className)}>
      <span className="font-medium text-stone-800">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-stone-500">{hint}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}

const control =
  "min-h-11 w-full rounded-[var(--radius)] border border-stone-300 bg-white px-3 text-base text-stone-900 " +
  "placeholder:text-stone-400 focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/25 disabled:bg-stone-100";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(control, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(control, "pe-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(control, "min-h-24 py-2", className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-[var(--radius)] border border-stone-200 bg-white p-4 shadow-sm", className)} {...props} />;
}

const badgeTones = {
  neutral: "bg-stone-100 text-stone-700",
  blue: "bg-sky-100 text-sky-800",
  amber: "bg-amber-100 text-amber-900",
  violet: "bg-violet-100 text-violet-800",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-800",
} as const;

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof badgeTones; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", badgeTones[tone], className)}>
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

export function PageHeader({ title, subtitle, back, actions }: { title: ReactNode; subtitle?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-flex min-h-11 items-center text-sm text-stone-600 hover:text-stone-900">
            <span aria-hidden className="me-1 rtl:rotate-180">←</span>
            {back.label}
          </Link>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-stone-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-stone-300 bg-white/60 px-6 py-10 text-center">
      <p className="font-medium text-stone-800">{title}</p>
      {body && <p className="mt-1 text-sm text-stone-600">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

const alertTones = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-900",
} as const;

export function Alert({ tone = "info", children, className }: { tone?: keyof typeof alertTones; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-[var(--radius)] border px-3 py-2 text-sm", alertTones[tone], className)}>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-stone-500">{hint}</span>}
    </Card>
  );
}

/** A label/value list for detail screens. */
export function DefinitionList({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map((item, i) => (
        <div key={i} className="contents">
          <dt className="text-stone-500">{item.label}</dt>
          <dd className="min-w-0 break-words text-stone-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
