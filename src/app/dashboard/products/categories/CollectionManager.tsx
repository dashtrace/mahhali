"use client";
import { useState } from "react";
import { Alert } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CatalogueMessages } from "@/i18n/messages/catalogue";
import type { CommonMessages } from "@/i18n/messages/common";
import { api } from "@/lib/api";
import { submitWith, useAction } from "../_components/useAction";

type Item = { id: string; name: string };
export type ManagedCollection = Item & { sections: Item[] };
type Copy = { m: CatalogueMessages; t: CommonMessages };

export function CollectionManager({ categoryId, collections, m, t }: { categoryId: string; collections: ManagedCollection[] } & Copy) {
  return <div className="space-y-5">
    <p className="hint">{m.hierarchyHint}</p>
    <AddItem url={`/api/categories/${categoryId}/collections`} label={m.addCollection} full={collections.length >= 30} m={m} t={t} />
    {collections.map((c, index) => <div className="inner-card" key={c.id}>
      <EditItem item={c} url={`/api/collections/${c.id}`} index={index} count={collections.length} m={m} t={t} />
      <details className="mt-3">
        <summary className="cursor-pointer font-semibold">{m.section} ({c.sections.length})</summary>
        <div className="space-y-3 mt-3">
          {c.sections.map((s, i) => <EditItem key={s.id} item={s} url={`/api/sections/${s.id}`} index={i} count={c.sections.length} m={m} t={t} />)}
          <AddItem url={`/api/collections/${c.id}/sections`} label={m.addSection} full={c.sections.length >= 30} m={m} t={t} />
        </div>
      </details>
    </div>)}
  </div>;
}

function AddItem({ url, label, full, m, t }: { url: string; label: string; full: boolean } & Copy) {
  const action = useAction(t.error);
  return <form onSubmit={submitWith(async (f, form) => {
    if (await action.run(() => api(url, { body: { name: String(f.get("name") ?? "").trim() } }))) form.reset();
  })}>
    <label className="field"><span>{label}</span>
      <div className="field-inline">
        <input name="name" className="control" required maxLength={40} disabled={full || action.busy} placeholder={m.groupName} dir="auto" />
        <button className="btn primary shrink-0" type="submit" disabled={full || action.busy}>{action.busy ? m.adding : t.add}</button>
      </div>
    </label>
    {full && <p className="hint">{fill(m.groupLimit, { max: 30 })}</p>}
    {action.error && <Alert tone="error">{action.error}</Alert>}
  </form>;
}

function EditItem({ item, url, index, count, m, t }: { item: Item; url: string; index: number; count: number } & Copy) {
  const action = useAction(t.error);
  const [editing, setEditing] = useState(false);
  return <div>
    {editing ? <form onSubmit={submitWith(async (f) => {
      if (await action.run(() => api(url, { method: "PATCH", body: { name: String(f.get("name") ?? "").trim() } }))) setEditing(false);
    })} className="space-y-2">
      <label className="field"><span>{m.groupName}</span><input className="control" name="name" required maxLength={40} defaultValue={item.name} dir="auto" /></label>
      <div className="actions">
        <button type="submit" className="btn primary" disabled={action.busy}>{t.save}</button>
        <button type="button" className="btn" disabled={action.busy} onClick={() => setEditing(false)}>{t.cancel}</button>
      </div>
    </form> : <div className="flex flex-wrap items-center justify-between gap-2">
      <strong className="break-words min-w-0">{item.name}</strong>
      <div className="flex flex-wrap gap-2">
        <button className="btn tiny" type="button" onClick={() => setEditing(true)} disabled={action.busy}>{m.rename}</button>
        <button className="btn tiny" type="button" aria-label={fill(m.moveUp, { name: item.name })} disabled={action.busy || index === 0} onClick={() => action.run(() => api(url, { method: "PATCH", body: { position: index - 1 } }))}>↑</button>
        <button className="btn tiny" type="button" aria-label={fill(m.moveDown, { name: item.name })} disabled={action.busy || index === count - 1} onClick={() => action.run(() => api(url, { method: "PATCH", body: { position: index + 1 } }))}>↓</button>
        <button className="btn tiny warn" type="button" disabled={action.busy} onClick={() => confirm(fill(m.deleteGroupConfirm, { name: item.name })) && action.run(() => api(url, { method: "DELETE" }))}>{t.remove}</button>
      </div>
    </div>}
    {action.error && <Alert tone="error" className="mt-2">{action.error}</Alert>}
  </div>;
}
