import { cloneElement, useId, type ReactElement, type ReactNode } from "react";

/** The demo's .field: label, one control, optional small print. */
export function Field({ label, hint, className, children }: { label: ReactNode; hint?: ReactNode; className?: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
      {hint && <p>{hint}</p>}
    </div>
  );
}
