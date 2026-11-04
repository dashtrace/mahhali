"use client";

import { useState } from "react";
import { Alert } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CatalogueMessages } from "@/i18n/messages/catalogue";
import type { CommonMessages } from "@/i18n/messages/common";
import { api } from "@/lib/api";
import { DashIcon } from "../../_components/DashIcon";
import { Dialog, Field } from "../../products/_components/kit";
import { submitWith, useAction, useSave } from "../../products/_components/useAction";

type Courier = { id: string; name: string; type: "COMPANY" | "INDIVIDUAL"; phone: string | null; active: boolean };
type Msgs = { m: CatalogueMessages; t: CommonMessages };

const fields = (f: FormData) => ({ name: f.get("name"), type: f.get("type"), phone: String(f.get("phone") ?? "").trim() || null });

function CourierFields({ courier, m }: { courier?: Courier; m: CatalogueMessages }) {
  return (
    <>
      <Field label={m.courierName}>
        <input name="name" className="control" defaultValue={courier?.name} required maxLength={80} />
      </Field>
      <Field label={m.courierType}>
        <select name="type" className="control" defaultValue={courier?.type ?? "COMPANY"}>
          <option value="COMPANY">{m.typeCOMPANY}</option>
          <option value="INDIVIDUAL">{m.typeINDIVIDUAL}</option>
        </select>
      </Field>
      <Field label={m.phone} hint={m.phoneHint}>
        <input name="phone" type="tel" inputMode="tel" autoComplete="off" className="control" defaultValue={courier?.phone ?? ""} dir="ltr" />
      </Field>
    </>
  );
}

/** The page header's Add button and its dialog. */
export function AddCourier({ m, t }: Msgs) {
  const [open, setOpen] = useState(false);
  const create = useAction(t.error);
  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>
        <DashIcon name="plus" size="sm" />
        {m.addCourier}
      </button>
      {open && (
        <Dialog title={m.addCourier} closeLabel={t.close} onClose={() => setOpen(false)}>
          <p className="hint">{m.courierDialogHint}</p>
          <form
            onSubmit={submitWith(async (f) => {
              if (await create.run(() => api("/api/couriers", { body: fields(f) }))) setOpen(false);
            })}
          >
            {create.error && <Alert tone="error" className="mb-3">{create.error}</Alert>}
            <CourierFields m={m} />
            <div className="actions">
              <button type="submit" className="btn primary" disabled={create.busy}>
                {create.busy ? t.saving : m.saveCourier}
              </button>
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                {t.cancel}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

export function Couriers({ couriers, canWrite, m, t }: { couriers: Courier[]; canWrite: boolean } & Msgs) {
  return (
    <>
      <div className="info-inline mb-4">
        <DashIcon name="info" size="sm" /> {m.courierNote}
      </div>
      {couriers.length === 0 ? (
        <div className="empty">
          <strong>{m.noCouriers}</strong>
          {m.noCouriersHint}
        </div>
      ) : (
        <div className="split">
          {couriers.map((c) => (
            <CourierCard key={c.id} courier={c} canWrite={canWrite} m={m} t={t} />
          ))}
        </div>
      )}
    </>
  );
}

function CourierCard({ courier: c, canWrite, m, t }: { courier: Courier; canWrite: boolean } & Msgs) {
  const [editing, setEditing] = useState(false);
  const action = useSave(t.error);
  const patch = (body: object) => action.run(() => api(`/api/couriers/${c.id}`, { method: "PATCH", body }));

  return (
    <div className="card">
      {!editing && action.error && <Alert tone="error" className="mb-3">{action.error}</Alert>}
      <div className="between">
        <div className="flex min-w-0 flex-wrap items-center gap-[9px]">
          <DashIcon name="truck" />
          <b className="min-w-0 break-words">{c.name}</b>
          <span className="mini-badge gray">{c.type === "COMPANY" ? m.typeCOMPANY : m.typeINDIVIDUAL}</span>
        </div>
        <span className={`mini-badge ${c.active ? "green" : "gray"}`}>{c.active ? m.active : m.inactive}</span>
      </div>
      {c.phone && (
        <p className="hint my-3.5">
          <a href={`tel:${c.phone}`} dir="ltr" className="inline-flex items-center gap-1">
            <DashIcon name="phone" size="sm" /> {c.phone}
          </a>
        </p>
      )}
      {canWrite && (
        <div className={`actions ${c.phone ? "" : "mt-3.5"}`}>
          <button type="button" className="btn tiny" onClick={() => setEditing(true)}>
            <DashIcon name="edit" size="sm" /> {m.editDetails}
          </button>
          {c.active ? (
            <button type="button" className="btn tiny" disabled={action.busy} onClick={() => confirm(fill(m.deactivateConfirm, { name: c.name })) && patch({ active: false })}>
              {m.deactivate}
            </button>
          ) : (
            <button type="button" className="btn tiny" disabled={action.busy} onClick={() => patch({ active: true })}>
              {m.reactivate}
            </button>
          )}
        </div>
      )}
      {!c.active && <p className="hint mt-2.5 mb-0">{m.inactiveNote}</p>}
      {editing && (
        <Dialog title={m.editCourier} closeLabel={t.close} onClose={() => setEditing(false)}>
          <p className="hint">{m.courierDialogHint}</p>
          <form
            {...action.form}
            onSubmit={submitWith(async (f) => {
              if (await action.save(() => api(`/api/couriers/${c.id}`, { method: "PATCH", body: fields(f) }))) setEditing(false);
            })}
          >
            {action.error && <Alert tone="error" className="mb-3">{action.error}</Alert>}
            <CourierFields courier={c} m={m} />
            <div className="actions">
              <button type="submit" className="btn primary" disabled={action.busy || !action.dirty}>
                {action.busy ? t.saving : m.saveCourier}
              </button>
              <button type="button" className="btn" onClick={() => setEditing(false)}>
                {t.cancel}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
