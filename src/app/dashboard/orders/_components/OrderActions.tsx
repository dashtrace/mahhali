"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Alert } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { OrderMessages } from "@/i18n/messages/orders";
import { ApiError, api, errorMessage } from "@/lib/api";
import { Dialog } from "../../products/_components/kit";
import { submitWith, useAction, useSave } from "../../products/_components/useAction";
import { AddressFields, addressFrom, type AddressValue } from "./AddressFields";
import { Field } from "./Field";
import { nextActionLabel } from "./labels";

type Status = "NEW" | "CONFIRMED" | "PACKED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "RETURNED";

/** What assigning a courier needs. Null when the role can't assign. */
export type AssignProps = { couriers: { id: string; name: string }[]; canAddCourier: boolean } | null;

/** A packed order's next step: choose its courier and send it out, in one go. */
export function AssignCourierDialog({
  order,
  couriers,
  canAddCourier,
  onClose,
  onDone,
  m,
  t,
}: {
  order: { id: string; number: number; courierId: string | null };
  couriers: { id: string; name: string }[];
  canAddCourier: boolean;
  onClose: () => void;
  onDone?: () => void;
  m: OrderMessages;
  t: CommonMessages;
}) {
  const action = useAction(m.actionFailed);
  const title = fill(m.assignTitle, { n: order.number });
  return (
    <Dialog title={title} closeLabel={t.close} onClose={onClose}>
      {couriers.length === 0 ? (
        <>
          <p className="hint">{m.noCouriers}</p>
          {canAddCourier && (
            <Link href="/dashboard/couriers" className="btn">
              {m.addCourier}
            </Link>
          )}
        </>
      ) : (
        <form
          onSubmit={submitWith(async (f) => {
            const courierId = String(f.get("courierId"));
            // A retry after a failed send finds the courier already saved, which is harmless.
            const ok = await action.run(async () => {
              if (courierId !== order.courierId) await api(`/api/orders/${order.id}`, { method: "PATCH", body: { courierId } });
              await api(`/api/orders/${order.id}/transitions`, { body: { to: "OUT_FOR_DELIVERY" } });
            });
            if (ok) {
              onDone?.();
              onClose();
            }
          })}
        >
          <p className="hint">{m.assignHint}</p>
          {action.error && <Alert tone="error" className="mb-3">{action.error}</Alert>}
          <Field label={m.courierTitle}>
            <select name="courierId" className="control" defaultValue={couriers.some((c) => c.id === order.courierId) ? (order.courierId ?? undefined) : undefined}>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="actions">
            <button type="submit" className="btn primary" disabled={action.busy}>
              {m.assignAndSend}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/** The forward move and Cancel. Delivered and Failed live in the delivery section. */
export function StatusActions({
  order,
  allowedNext,
  assign,
  m,
  t,
}: {
  order: { id: string; number: number; courierId: string | null };
  allowedNext: readonly Status[];
  assign: AssignProps;
  m: OrderMessages;
  t: CommonMessages;
}) {
  const orderId = order.id;
  const [assigning, setAssigning] = useState(false);
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  // Stays busy until the refreshed order renders, so the next step can't be sent twice.
  const [refreshing, startTransition] = useTransition();
  const busy = moving || refreshing;
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState("");
  const next = allowedNext.find((s) => s !== "CANCELLED" && s !== "DELIVERED" && s !== "RETURNED");

  async function move(to: Status, body: { note?: string } = {}) {
    setMoving(true);
    setError(null);
    try {
      await api(`/api/orders/${orderId}/transitions`, { body: { to, ...body } });
      setCancelling(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof ApiError && e.code === "COURIER_REQUIRED" ? m.courierRequired : errorMessage(e, m.actionFailed));
    } finally {
      setMoving(false);
    }
  }

  if (cancelling) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          move("CANCELLED", { note: note.trim() || undefined });
        }}
      >
        {error && <Alert tone="error" className="mb-3">{error}</Alert>}
        <Field label={`${m.cancelReason} (${t.optional})`}>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} autoFocus className="control" />
        </Field>
        <div className="actions">
          <button type="button" className="btn" onClick={() => setCancelling(false)} disabled={busy}>
            {m.keepOrder}
          </button>
          <button type="submit" className="btn warn" disabled={busy}>
            {m.confirmCancel}
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}
      <div className="actions">
        {next === "OUT_FOR_DELIVERY" && assign ? (
          <button type="button" className="btn primary" onClick={() => setAssigning(true)}>
            {m.assignCourier}
          </button>
        ) : (
          next && (
            <button type="button" className="btn primary" disabled={busy} onClick={() => move(next)}>
              {nextActionLabel(m, next)}
            </button>
          )
        )}
        {allowedNext.includes("CANCELLED") && (
          <button type="button" className="btn warn" onClick={() => setCancelling(true)}>
            {m.cancelOrder}
          </button>
        )}
      </div>
      {assigning && assign && <AssignCourierDialog order={order} {...assign} onClose={() => setAssigning(false)} m={m} t={t} />}
    </>
  );
}

function SaveButton({ state, t, children }: { state: { busy: boolean; dirty: boolean; saved: boolean }; t: CommonMessages; children?: ReactNode }) {
  return (
    <button type="submit" className="btn primary" disabled={state.busy || !state.dirty}>
      <span aria-live="polite">{state.busy ? t.saving : state.saved ? `✓ ${t.saved}` : (children ?? t.save)}</span>
    </button>
  );
}

export function CourierForm({
  orderId,
  courierId,
  couriers,
  canAddCourier,
  m,
  t,
}: {
  orderId: string;
  courierId: string | null;
  couriers: { id: string; name: string }[];
  canAddCourier: boolean;
  m: OrderMessages;
  t: CommonMessages;
}) {
  const [value, setValue] = useState(courierId ?? "");
  const save = useSave(m.actionFailed, value);

  if (!couriers.length && !courierId) {
    return (
      <>
        <p className="hint">{m.noCouriers}</p>
        {canAddCourier && (
          <Link href="/dashboard/couriers" className="btn">
            {m.addCourier}
          </Link>
        )}
      </>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.save(() => api(`/api/orders/${orderId}`, { method: "PATCH", body: { courierId: value || null } }));
      }}
    >
      {save.error && <Alert tone="error" className="mb-3">{save.error}</Alert>}
      <Field label={m.courierTitle}>
        <select value={value} onChange={(e) => setValue(e.target.value)} className="control">
          <option value="">{m.unassigned}</option>
          {couriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <SaveButton state={save} t={t}>
        {m.saveCourier}
      </SaveButton>
    </form>
  );
}

export function EditOrderForm({
  orderId,
  address,
  notes,
  m,
  t,
}: {
  orderId: string;
  address: AddressValue;
  notes: string | null;
  m: OrderMessages;
  t: CommonMessages;
}) {
  const [open, setOpen] = useState(false);
  const save = useSave(m.actionFailed);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (await save.save(() => api(`/api/orders/${orderId}`, { method: "PATCH", body: { address: addressFrom(form), notes: String(form.get("notes") ?? "") } }))) setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" className="btn tiny mt-3" onClick={() => setOpen(true)}>
        {m.editAddress}
      </button>
    );
  }
  return (
    <form {...save.form} onSubmit={submit} className="mt-4">
      {save.error && <Alert tone="error" className="mb-3">{save.error}</Alert>}
      <AddressFields value={address} m={m} t={t} />
      <Field label={`${m.notes} (${t.optional})`}>
        <textarea name="notes" maxLength={500} defaultValue={notes ?? ""} className="control area" />
      </Field>
      <div className="actions">
        <button type="button" className="btn" onClick={() => setOpen(false)} disabled={save.busy}>
          {t.cancel}
        </button>
        <SaveButton state={save} t={t} />
      </div>
    </form>
  );
}
