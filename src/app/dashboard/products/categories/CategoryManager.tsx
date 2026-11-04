"use client";

import { useState } from "react";
import { Alert, PageHeader } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CatalogueMessages } from "@/i18n/messages/catalogue";
import type { CommonMessages } from "@/i18n/messages/common";
import { api } from "@/lib/api";
import { DashIcon } from "../../_components/DashIcon";
import { BackLink, Dialog, Field } from "../_components/kit";
import { submitWith, useAction, useSave } from "../_components/useAction";

type Category = { id: string; name: string; count: number };
type Props = { categories: Category[]; canWrite: boolean; max: number; m: CatalogueMessages; t: CommonMessages };

export function CategoryManager({ categories, canWrite, max, m, t }: Props) {
  const add = useAction(t.error);
  const [reorder, setReorder] = useState(false);
  const full = categories.length >= max;

  return (
    <>
      <BackLink href="/dashboard/products">{m.backToProducts}</BackLink>
      <PageHeader
        title={m.categoriesTitle}
        subtitle={m.categoriesHint}
        actions={
          canWrite && (
            <button type="button" className={`btn ${reorder ? "primary" : ""}`} aria-pressed={reorder} onClick={() => setReorder(!reorder)}>
              <DashIcon name="grip" size="sm" />
              {reorder ? m.finishReorder : m.reorder}
            </button>
          )
        }
      />
      <div className="card max-w-[850px]">
        {canWrite &&
          (full ? (
            <p className="callout mt-0">{fill(m.categoryLimit, { max })}</p>
          ) : (
            <form
              onSubmit={submitWith(async (f, form) => {
                if (await add.run(() => api("/api/categories", { body: { name: String(f.get("name") ?? "").trim() } }))) form.reset();
              })}
              className="field"
            >
              <label htmlFor="new-category">{m.addACategory}</label>
              <div className="field-inline">
                <input id="new-category" name="name" className="control" required maxLength={40} placeholder={m.categoryNamePlaceholder} dir="auto" />
                <button type="submit" className="btn primary shrink-0" disabled={add.busy}>
                  <DashIcon name="plus" size="sm" />
                  {add.busy ? m.adding : t.add}
                </button>
              </div>
              {add.error && <Alert tone="error" className="mt-2">{add.error}</Alert>}
            </form>
          ))}
        {canWrite && (
          <div className="info-inline mb-[15px]">
            <DashIcon name="info" size="sm" /> {reorder ? m.reorderOn : fill(m.reorderOff, { max })}
          </div>
        )}
        {categories.length === 0 ? (
          <div className="empty">
            <strong>{m.noCategories}</strong>
            {canWrite && m.noCategoriesHint}
          </div>
        ) : (
          <ol>
            {categories.map((c, i) => (
              <Row key={c.id} category={c} index={i} last={i === categories.length - 1} canWrite={canWrite} reorder={reorder} m={m} t={t} />
            ))}
          </ol>
        )}
      </div>
    </>
  );
}

function Row({
  category: c,
  index,
  last,
  canWrite,
  reorder,
  m,
  t,
}: {
  category: Category;
  index: number;
  last: boolean;
  canWrite: boolean;
  reorder: boolean;
  m: CatalogueMessages;
  t: CommonMessages;
}) {
  const action = useSave(t.error);
  const [renaming, setRenaming] = useState(false);
  const [dragging, setDragging] = useState(false);
  const move = (id: string, position: number) => action.run(() => api(`/api/categories/${id}`, { method: "PATCH", body: { position } }));

  return (
    <li
      className={`category-row ${dragging ? "dragging" : ""}`}
      draggable={canWrite && reorder}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", c.id);
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={(e) => {
        if (canWrite && reorder) e.preventDefault();
      }}
      onDrop={(e) => {
        const id = e.dataTransfer.getData("text/plain");
        if (!canWrite || !reorder || !id || id === c.id) return;
        e.preventDefault();
        move(id, index);
      }}
    >
      <span className="grip">{canWrite && <DashIcon name="grip" />}</span>
      <div className="min-w-0">
        <b className="break-words">{c.name}</b>
        <p className="hint mt-[3px] mb-0">{fill(m.positionCount, { i: index + 1, n: c.count })}</p>
        {!renaming && action.error && <Alert tone="error" className="mt-2">{action.error}</Alert>}
      </div>
      {canWrite && (
        <div className="buttons">
          {reorder ? (
            <>
              <button type="button" aria-label={fill(m.moveUp, { name: c.name })} disabled={action.busy || index === 0} onClick={() => move(c.id, index - 1)}>
                <DashIcon name="up" size="sm" />
                <span className="block">{m.moveUpShort}</span>
              </button>
              <button type="button" aria-label={fill(m.moveDown, { name: c.name })} disabled={action.busy || last} onClick={() => move(c.id, index + 1)}>
                <DashIcon name="down" size="sm" />
                <span className="block">{m.moveDownShort}</span>
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setRenaming(true)}>
              <DashIcon name="edit" size="sm" /> {m.rename}
            </button>
          )}
        </div>
      )}
      {renaming && (
        <Dialog title={fill(m.renameTitle, { name: c.name })} closeLabel={t.close} onClose={() => setRenaming(false)}>
          <form
            {...action.form}
            onSubmit={submitWith(async (f) => {
              if (!action.dirty || (await action.save(() => api(`/api/categories/${c.id}`, { method: "PATCH", body: { name: String(f.get("name") ?? "").trim() } })))) setRenaming(false);
            })}
          >
            <Field label={m.categoryName}>
              <input name="name" className="control" defaultValue={c.name} required maxLength={40} dir="auto" />
            </Field>
            {action.error && <Alert tone="error" className="mb-3">{action.error}</Alert>}
            <div className="actions">
              <button type="submit" className="btn primary" disabled={action.busy}>
                {action.busy ? t.saving : m.saveName}
              </button>
              <button type="button" className="btn" onClick={() => setRenaming(false)}>
                {t.cancel}
              </button>
            </div>
          </form>
          <hr className="separator" />
          <button
            type="button"
            className="btn warn"
            disabled={action.busy}
            onClick={() => confirm(fill(m.deleteCategoryConfirm, { name: c.name })) && action.run(() => api(`/api/categories/${c.id}`, { method: "DELETE" }))}
          >
            <DashIcon name="x" size="sm" />
            {fill(m.deleteCategory, { name: c.name })}
          </button>
        </Dialog>
      )}
    </li>
  );
}
