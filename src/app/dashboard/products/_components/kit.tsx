"use client";

import Link from "next/link";
import { cloneElement, useEffect, useId, useRef, type ReactElement, type ReactNode } from "react";
import { DashIcon } from "../../_components/DashIcon";

/** The "Back to products" button above a page head. */
export function BackLink({ href, className = "mb-3.5", children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={`btn tiny ${className}`}>
      <DashIcon name="left" size="sm" />
      {children}
    </Link>
  );
}

/** A .field: label, one control, optional small print. */
export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactElement<{ id?: string }>; className?: string }) {
  const id = useId();
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
      {hint && <p>{hint}</p>}
    </div>
  );
}

/** A checkbox line with its explanation underneath, as on the Display step. */
export function Check({ label, hint, ...props }: { label: ReactNode; hint?: ReactNode } & Omit<React.ComponentProps<"input">, "type">) {
  return (
    <div className="field">
      <label>
        <input type="checkbox" className="check-box" {...props} /> {label}
      </label>
      {hint && <p>{hint}</p>}
    </div>
  );
}

/** The numbered step pills. Keeps the current one in view when a phone has to scroll them. */
export function Steps<K extends string>({ items, current, onPick }: { items: [K, string][]; current: K; onPick: (k: K) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector(".active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);
  return (
    <div ref={ref} className="steps">
      {items.map(([k, label], i) => (
        <button key={k} type="button" className={k === current ? "active" : ""} aria-current={k === current ? "step" : undefined} onClick={() => onPick(k)}>
          {i + 1}. {label}
        </button>
      ))}
    </div>
  );
}

/** A centred modal. Render it only while open; the browser traps focus and handles Escape. */
export function Dialog({ title, closeLabel, onClose, children }: { title: ReactNode; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div>
        <div className="between mb-5">
          <h2 id={titleId} className="m-0 min-w-0">
            {title}
          </h2>
          <button type="button" className="btn tiny shrink-0" aria-label={closeLabel} onClick={onClose}>
            <DashIcon name="x" size="sm" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
