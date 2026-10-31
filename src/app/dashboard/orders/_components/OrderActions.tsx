"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Alert, Button, ButtonLink, Field, Input, SaveButton, Select, Textarea } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { OrderMessages } from "@/i18n/messages/orders";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useSave } from "../../products/_components/useAction";
import { AddressFields, addressFrom, type AddressValue } from "./AddressFields";
import { statusLabel } from "./labels";

type Status = "NEW" | "CONFIRMED" | "PACKED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "RETURNED";

/** The forward move and Cancel. Delivered and Failed live in the delivery section. */
export function StatusActions({
  orderId,
  allowedNext,
  hasCourier,
  m,
  t,
}: {
  orderId: string;
  allowedNext: readonly Status[];
  hasCourier: boolean;
  m: OrderMessages;
  t: CommonMessages;
}) {
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
      if (e instanceof ApiError && e.code === "COURIER_REQUIRED") {
        setError(m.courierRequired);
        location.hash = "courier";
      } else setError(errorMessage(e, m.actionFailed));
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      {next === "OUT_FOR_DELIVERY" && !hasCourier ? (
        <>
          <p className="text-sm text-sl-muted">{m.courierRequired}</p>
          <ButtonLink href="#courier" block>
            {m.assignCourier}
          </ButtonLink>
        </>
      ) : (
        next && (
          <Button block disabled={busy} onClick={() => move(next)} className="min-h-12 text-base">
            {fill(m.moveTo, { status: statusLabel(t, next) })}
          </Button>
        )
      )}
      {allowedNext.includes("CANCELLED") &&
        (cancelling ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              move("CANCELLED", { note: note.trim() || undefined });
            }}
          >
            <Field label={`${m.cancelReason} (${t.optional})`}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Button tone="secondary" onClick={() => setCancelling(false)} disabled={busy}>
                {m.keepOrder}
              </Button>
              <Button type="submit" tone="danger" disabled={busy}>
                {m.confirmCancel}
              </Button>
            </div>
          </form>
        ) : (
          <Button tone="ghost" block onClick={() => setCancelling(true)} className="text-sl-danger">
            {m.cancelOrder}
          </Button>
        ))}
    </div>
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
      <div className="flex flex-col gap-2 text-sm text-sl-muted">
        <p>{m.noCouriers}</p>
        {canAddCourier && (
          <ButtonLink href="/dashboard/couriers" tone="secondary">
            {m.addCourier}
          </ButtonLink>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.save(() => api(`/api/orders/${orderId}`, { method: "PATCH", body: { courierId: value || null } }));
      }}
      className="flex flex-col gap-2"
    >
      {save.error && <Alert tone="error">{save.error}</Alert>}
      <Field label={m.courierTitle}>
        <Select value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">{m.unassigned}</option>
          {couriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <SaveButton state={save} labels={t}>
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
      <Button tone="secondary" block onClick={() => setOpen(true)}>
        {m.editAddress}
      </Button>
    );
  }
  return (
    <form {...save.form} onSubmit={submit} className="flex flex-col gap-3">
      {save.error && <Alert tone="error">{save.error}</Alert>}
      <AddressFields value={address} m={m} t={t} />
      <Field label={`${m.notes} (${t.optional})`}>
        <Textarea name="notes" maxLength={500} defaultValue={notes ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Button tone="secondary" onClick={() => setOpen(false)} disabled={save.busy}>
          {t.cancel}
        </Button>
        <SaveButton state={save} labels={t} />
      </div>
    </form>
  );
}
