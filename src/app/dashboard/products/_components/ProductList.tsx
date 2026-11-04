"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fill } from "@/i18n/locale";
import type { CatalogueMessages } from "@/i18n/messages/catalogue";
import type { CommonMessages } from "@/i18n/messages/common";
import { DashIcon } from "../../_components/DashIcon";

export type ProductRow = {
  id: string;
  name: string;
  image: string | null;
  categoryId: string | null;
  categoryName: string | null;
  price: string;
  stock: number;
  optionCount: number;
  archived: boolean;
  featured: boolean;
  href: string;
};
export type ProductMode = "active" | "archived" | "all";

// shortcut: the API returns every product and this list filters them in the browser; add server paging if shops pass a few thousand.
const PAGE = 24;
const LOW_STOCK = 10;
const low = (p: ProductRow) => !p.archived && p.stock < LOW_STOCK;

export function ProductList({
  rows,
  categories,
  canWrite,
  initialMode,
  initialCategory,
  m,
  t,
}: {
  rows: ProductRow[];
  categories: { id: string; name: string }[];
  canWrite: boolean;
  initialMode: ProductMode;
  initialCategory: string;
  m: CatalogueMessages;
  t: CommonMessages;
}) {
  const [mode, setMode] = useState(initialMode);
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  // Back from the editor returns to the same filters.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (mode === "active") q.delete("show");
    else q.set("show", mode);
    if (category) q.set("cat", category);
    else q.delete("cat");
    const s = q.toString();
    history.replaceState(null, "", s ? `?${s}` : location.pathname);
  }, [mode, category]);

  const needle = query.trim().toLocaleLowerCase();
  const list = rows.filter(
    (p) =>
      (mode === "all" || p.archived === (mode === "archived")) &&
      (!category || p.categoryId === category) &&
      (!needle || p.name.toLocaleLowerCase().includes(needle)) &&
      (!lowOnly || low(p)),
  );
  const change = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setLimit(PAGE);
  };
  const lowCount = rows.filter(low).length;

  return (
    <>
      <div className="toolbar">
        <input className="control search" placeholder={m.searchProducts} aria-label={m.searchProducts} value={query} onChange={(e) => change(setQuery)(e.target.value)} dir="auto" />
        {categories.length > 0 && (
          <select className="control" aria-label={m.category} value={category} onChange={(e) => change(setCategory)(e.target.value)}>
            <option value="">{t.all}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <div className="segbar m-0" role="group" aria-label={m.productsFilter}>
          {(
            [
              ["active", m.activeOnly],
              ["archived", m.archivedOnly],
              ["all", t.all],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => change(setMode)(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="between mt-3 mb-4">
        <span className="hint">{fill(m.results, { n: list.length })}</span>
        {lowCount > 0 && (
          <button type="button" className={`btn tiny ${lowOnly ? "soft" : ""}`} aria-pressed={lowOnly} onClick={() => change(setLowOnly)(!lowOnly)}>
            <DashIcon name="warning" size="sm" />
            {fill(m.lowOrOut, { n: lowCount })}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <strong>{rows.length === 0 ? m.noProducts : m.noMatch}</strong>
          {rows.length === 0 && canWrite && <p className="hint mb-3">{m.noProductsHint}</p>}
          {rows.length === 0 && canWrite && (
            <Link href="/dashboard/products/new" className="btn primary">
              <DashIcon name="plus" size="sm" />
              {m.addProduct}
            </Link>
          )}
        </div>
      ) : (
        <div className="product-list">
          {list.slice(0, limit).map((p) => (
            <article key={p.id} className="product-manage">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
                <img src={p.image} alt={p.name} loading="lazy" />
              ) : (
                <div className="no-photo">
                  <DashIcon name="box" />
                </div>
              )}
              <div className="prod-body">
                <div className="between">
                  <b className="min-w-0 break-words">{p.name}</b>
                  <Badge p={p} m={m} />
                </div>
                <div className="hint my-2">
                  {[p.categoryName, p.optionCount > 0 && (p.optionCount === 1 ? m.optionTypeOne : fill(m.optionTypes, { n: p.optionCount })), p.featured && m.featured].filter(Boolean).join(" · ")}
                </div>
                <div className="between">
                  <b>
                    <bdi>{p.price}</bdi>
                  </b>
                  <span className={`mini-badge ${p.stock < LOW_STOCK ? "red" : "green"}`}>{fill(m.available, { n: p.stock })}</span>
                </div>
                <Link href={p.href} className="btn soft">
                  {canWrite ? m.editProduct : m.viewProduct}
                  <DashIcon name="arrow" size="tiny" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      {list.length > limit && (
        <div className="mt-4 text-center">
          <p className="load-note">{fill(m.shownOf, { shown: limit, total: list.length })}</p>
          <button type="button" className="btn" onClick={() => setLimit(limit + PAGE)}>
            {m.showMore}
          </button>
        </div>
      )}
    </>
  );
}

function Badge({ p, m }: { p: ProductRow; m: CatalogueMessages }) {
  if (p.archived) return <span className="mini-badge amber shrink-0">{m.archived}</span>;
  if (p.stock === 0) return <span className="mini-badge red shrink-0">{m.outOfStock}</span>;
  if (p.stock < LOW_STOCK) return <span className="mini-badge gray shrink-0">{m.lowStock}</span>;
  return <span className="mini-badge green shrink-0">{m.activeOnly}</span>;
}
