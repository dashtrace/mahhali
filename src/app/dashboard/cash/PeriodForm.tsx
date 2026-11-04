"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field } from "../products/_components/kit";

/**
 * The date range (and courier) live in the URL. Choosing a value applies it; the pause lets someone
 * finish typing a date, because a date field reports a change on every digit. Without JavaScript
 * it is a plain GET form with an Apply button.
 */
export function PeriodForm({
  from,
  to,
  courierId,
  couriers,
  labels,
}: {
  from: string;
  to: string;
  courierId?: string;
  couriers?: { id: string; name: string }[];
  labels: { from: string; to: string; apply: string; rangeError: string; courier: string; allCouriers: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [badRange, setBadRange] = useState(false);
  // Leaving the page must not apply a pending change and bring the person back.
  useEffect(() => () => clearTimeout(timer.current), []);

  function apply(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) if (typeof value === "string" && value) params.set(key, value);
    const start = params.get("from");
    const end = params.get("to");
    const bad = Boolean(start && end && start > end);
    setBadRange(bad);
    if (!bad) router.replace(`${pathname}?${params}`, { scroll: false });
  }

  function changed(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(form), (e.target as HTMLElement).tagName === "SELECT" ? 0 : 600);
  }

  return (
    <form className="card" onChange={changed}>
      <div className="split3">
        <Field label={labels.from}>
          <input type="date" name="from" className="control" defaultValue={from} />
        </Field>
        <Field label={labels.to}>
          <input type="date" name="to" className="control" defaultValue={to} />
        </Field>
        {couriers && (
          <Field label={labels.courier}>
            <select name="courierId" className="control" defaultValue={courierId ?? ""}>
              <option value="">{labels.allCouriers}</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {badRange && (
        <p role="alert" className="hint text-(--red)">
          {labels.rangeError}
        </p>
      )}
      <noscript>
        <button type="submit" className="btn">
          {labels.apply}
        </button>
      </noscript>
    </form>
  );
}
