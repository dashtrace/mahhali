"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Select, cx } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fill } from "@/i18n/locale";
import type { CatalogueMessages } from "@/i18n/messages/catalogue";
import type { CommonMessages } from "@/i18n/messages/common";
import { api } from "@/lib/api";
import { submitWith, useAction } from "../../products/_components/useAction";

type Courier = { id: string; name: string; type: "COMPANY" | "INDIVIDUAL"; phone: string | null; active: boolean };
type Msgs = { m: CatalogueMessages; t: CommonMessages };

const fields = (f: FormData) => ({ name: f.get("name"), type: f.get("type"), phone: String(f.get("phone") ?? "").trim() || null });

function CourierFields({ courier, m }: { courier?: Courier; m: CatalogueMessages }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label={m.courierName}>
        <Input name="name" defaultValue={courier?.name} required maxLength={80} />
      </Field>
      <Field label={m.courierType}>
        <Select name="type" defaultValue={courier?.type ?? "COMPANY"}>
          <option value="COMPANY">{m.typeCOMPANY}</option>
          <option value="INDIVIDUAL">{m.typeINDIVIDUAL}</option>
        </Select>
      </Field>
      <Field label={m.phone} hint={m.phoneHint}>
        <Input name="phone" type="tel" inputMode="tel" autoComplete="off" defaultValue={courier?.phone ?? ""} dir="ltr" />
      </Field>
    </div>
  );
}

export function Couriers({ couriers, canWrite, m, t }: { couriers: Courier[]; canWrite: boolean } & Msgs) {
  const [adding, setAdding] = useState(false);
  const create = useAction(t.error);

  return (
    <div className="flex flex-col gap-3">
      {canWrite &&
        (adding ? (
          <Card>
            <form
              onSubmit={submitWith(async (f) => {
                if (await create.run(() => api("/api/couriers", { body: fields(f) }))) setAdding(false);
              })}
              className="flex flex-col gap-3"
            >
              <h2 className="font-semibold">{m.addCourier}</h2>
              {create.error && <Alert tone="error">{create.error}</Alert>}
              <CourierFields m={m} />
              <div className="flex gap-2">
                <Button type="submit" disabled={create.busy}>
                  {create.busy ? t.saving : t.add}
                </Button>
                <Button tone="ghost" onClick={() => setAdding(false)}>
                  {t.cancel}
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Button className="self-start" onClick={() => setAdding(true)}>
            <Icon name="plus" />
            {m.addCourier}
          </Button>
        ))}

      {couriers.length === 0 ? (
        <EmptyState title={m.noCouriers} body={m.noCouriersHint} />
      ) : (
        <ul className="flex flex-col gap-3">
          {couriers.map((c) => (
            <li key={c.id}>
              <CourierRow courier={c} canWrite={canWrite} m={m} t={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CourierRow({ courier: c, canWrite, m, t }: { courier: Courier; canWrite: boolean } & Msgs) {
  const [editing, setEditing] = useState(false);
  const action = useAction(t.error);
  const patch = (body: object) => action.run(() => api(`/api/couriers/${c.id}`, { method: "PATCH", body }));

  if (editing) {
    return (
      <Card>
        <form
          onSubmit={submitWith(async (f) => {
            if (await patch(fields(f))) setEditing(false);
          })}
          className="flex flex-col gap-3"
        >
          {action.error && <Alert tone="error">{action.error}</Alert>}
          <CourierFields courier={c} m={m} />
          <div className="flex gap-2">
            <Button type="submit" disabled={action.busy}>
              {action.busy ? t.saving : t.save}
            </Button>
            <Button tone="ghost" onClick={() => setEditing(false)}>
              {t.cancel}
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className={cx("flex flex-col gap-2", !c.active && "bg-stone-50")}>
      {action.error && <Alert tone="error">{action.error}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">{c.name}</h2>
        <Badge tone={c.type === "COMPANY" ? "blue" : "violet"}>{c.type === "COMPANY" ? m.typeCOMPANY : m.typeINDIVIDUAL}</Badge>
        {!c.active && <Badge>{m.inactive}</Badge>}
      </div>
      {c.phone && (
        <a href={`tel:${c.phone}`} dir="ltr" className="inline-flex min-h-11 items-center gap-2 self-start text-sm text-stone-700">
          <Icon name="phone" className="size-4" />
          {c.phone}
        </a>
      )}
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <Button tone="secondary" onClick={() => setEditing(true)}>
            {t.edit}
          </Button>
          {c.active ? (
            <Button tone="ghost" disabled={action.busy} onClick={() => confirm(fill(m.deactivateConfirm, { name: c.name })) && patch({ active: false })}>
              {m.deactivate}
            </Button>
          ) : (
            <Button tone="ghost" disabled={action.busy} onClick={() => patch({ active: true })}>
              {m.reactivate}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
