"use client";

import { Alert, Button, Card, EmptyState, IconButton, Input } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fill } from "@/i18n/locale";
import type { CatalogueMessages } from "@/i18n/messages/catalogue";
import type { CommonMessages } from "@/i18n/messages/common";
import { api } from "@/lib/api";
import { submitWith, useAction } from "../_components/useAction";

type Category = { id: string; name: string; count: number };
type Props = { categories: Category[]; canWrite: boolean; max: number; m: CatalogueMessages; t: CommonMessages };

export function CategoryManager({ categories, canWrite, max, m, t }: Props) {
  const add = useAction(t.error);
  const full = categories.length >= max;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {canWrite &&
        (full ? (
          <Alert tone="note">{fill(m.categoryLimit, { max })}</Alert>
        ) : (
          <Card>
            <form
              onSubmit={submitWith(async (f, form) => {
                if (await add.run(() => api("/api/categories", { body: { name: String(f.get("name") ?? "").trim() } }))) form.reset();
              })}
              className="flex flex-col gap-2"
            >
              <label htmlFor="new-category" className="text-[13px] font-bold">
                {m.categoryName}
              </label>
              <div className="flex gap-2">
                <Input id="new-category" name="name" required maxLength={40} placeholder={m.categoryNamePlaceholder} />
                <Button type="submit" disabled={add.busy} className="shrink-0">
                  <Icon name="plus" />
                  {add.busy ? m.adding : m.addCategory}
                </Button>
              </div>
              {add.error && <Alert tone="error">{add.error}</Alert>}
            </form>
          </Card>
        ))}

      {categories.length === 0 ? (
        <EmptyState title={m.noCategories} body={canWrite ? m.noCategoriesHint : undefined} />
      ) : (
        <Card className="p-0">
          <ol className="divide-y divide-sl-border">
            {categories.map((c, i) => (
              <Row key={`${c.id}|${c.name}|${i}`} category={c} index={i} last={i === categories.length - 1} canWrite={canWrite} m={m} t={t} />
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

function Row({ category: c, index, last, canWrite, m, t }: { category: Category; index: number; last: boolean; canWrite: boolean; m: CatalogueMessages; t: CommonMessages }) {
  const action = useAction(t.error);
  const move = (position: number) => action.run(() => api(`/api/categories/${c.id}`, { method: "PATCH", body: { position } }));
  const count = <span className="text-xs text-sl-muted tabular-nums">{fill(m.categoryCount, { n: c.count })}</span>;

  if (!canWrite) {
    return (
      <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
        <span className="font-bold">{c.name}</span>
        {count}
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-2 px-3 py-3 sm:px-4">
      <form
        onSubmit={submitWith((f) => action.run(() => api(`/api/categories/${c.id}`, { method: "PATCH", body: { name: String(f.get("name") ?? "").trim() } })))}
        className="flex items-center gap-2"
      >
        <Input name="name" aria-label={fill(m.renameCategory, { name: c.name })} defaultValue={c.name} required maxLength={40} className="min-w-0" />
        <Button type="submit" tone="secondary" disabled={action.busy} className="shrink-0">
          {t.save}
        </Button>
      </form>
      <div className="flex items-center gap-1.5">
        {count}
        <span className="ms-auto flex gap-1.5">
          <IconButton label={fill(m.moveUp, { name: c.name })} icon={<Icon name="chevron" className="size-5 rotate-180" />} disabled={action.busy || index === 0} onClick={() => move(index - 1)} />
          <IconButton label={fill(m.moveDown, { name: c.name })} icon="chevron" disabled={action.busy || last} onClick={() => move(index + 1)} />
          <IconButton
            label={fill(m.deleteCategory, { name: c.name })}
            icon="x"
            disabled={action.busy}
            className="text-sl-danger"
            onClick={() => confirm(fill(m.deleteCategoryConfirm, { name: c.name })) && action.run(() => api(`/api/categories/${c.id}`, { method: "DELETE" }))}
          />
        </span>
      </div>
      {action.error && <Alert tone="error">{action.error}</Alert>}
    </li>
  );
}
