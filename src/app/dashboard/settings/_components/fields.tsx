import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/components/ui";
import { DashIcon } from "../../_components/DashIcon";

/** The demo's .field: a label, its control and a hint. settings.css draws it. */
export function SettingField({ label, hint, className, children }: { label: ReactNode; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <label className={cx("field block", className)}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** ui.tsx's SaveButton as the dashboard's .btn: off until something changed, then "Saving…", then "✓ Saved" until the next edit. */
export function SaveBtn({
  state,
  labels,
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & { state: { busy: boolean; dirty: boolean; saved: boolean }; labels: { save: string; saving: string; saved: string } }) {
  return (
    <button type="submit" className="btn primary" disabled={disabled || state.busy || !state.dirty} {...props}>
      {state.saved && !state.busy && <DashIcon name="check" size="sm" />}
      <span aria-live="polite">{state.busy ? labels.saving : state.saved ? labels.saved : (children ?? labels.save)}</span>
    </button>
  );
}
