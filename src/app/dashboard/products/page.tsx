import Link from "next/link";
import { Alert, Badge, ButtonLink, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fill } from "@/i18n/locale";
import { catalogueMessages } from "@/i18n/messages/catalogue";
import { getLocale } from "@/i18n/server";
import { formatMoney } from "@/lib/format";
import { can } from "@/server/domain/policy";
import { accountService } from "@/server/services/accountService";
import { productService } from "@/server/services/productService";
import { pageActor } from "../../_server/session";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ archived?: string; welcome?: string }> }) {
  const actor = await pageActor("product.read", "/dashboard/products");
  const sp = await searchParams;
  const locale = await getLocale();
  const m = catalogueMessages[locale];
  const includeArchived = sp.archived === "1";
  const canWrite = can(actor.role, "product.write");
  const [me, products] = await Promise.all([accountService.me(actor), productService.list(actor, { includeArchived })]);
  const currency = me.shop.currency;

  return (
    <>
      <PageHeader
        title={m.productsTitle}
        actions={
          <>
            <ButtonLink tone="secondary" href={includeArchived ? "/dashboard/products" : "/dashboard/products?archived=1"}>
              {includeArchived ? m.hideArchived : m.showArchived}
            </ButtonLink>
            {canWrite && (
              <ButtonLink href="/dashboard/products/new">
                <Icon name="plus" />
                {m.newProduct}
              </ButtonLink>
            )}
          </>
        }
      />
      {sp.welcome && <Alert tone="success" className="mb-4">{m.welcome}</Alert>}
      {!canWrite && <Alert className="mb-4">{m.readOnly}</Alert>}
      {products.length === 0 ? (
        <EmptyState
          title={m.noProducts}
          body={canWrite ? m.noProductsHint : undefined}
          action={canWrite && <ButtonLink href="/dashboard/products/new">{m.newProduct}</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {products.map((p) => {
            const body = (
              <Card className={cx("flex gap-3", canWrite && "hover:border-stone-300")}>
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
                  <img src={p.images[0].url} alt="" className="size-16 shrink-0 rounded-[var(--radius)] object-cover" />
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-[var(--radius)] bg-stone-100 text-stone-400">
                    <Icon name="box" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold">{p.name}</h2>
                    {p.status === "ARCHIVED" && <Badge>{m.archived}</Badge>}
                  </div>
                  <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                    {p.variants.map((v) => (
                      <li key={v.id} className={cx("flex flex-wrap items-center gap-x-2", v.archived && "text-stone-400")}>
                        <span className="font-medium">{[v.size, v.colour].filter(Boolean).join(" / ") || m.noOptions}</span>
                        <span className="tabular-nums text-stone-600">{formatMoney(v.priceMinor, currency, locale)}</span>
                        <Badge tone={v.available > 0 ? "green" : "red"}>{fill(m.available, { n: v.available })}</Badge>
                        {v.reserved > 0 && <Badge tone="amber">{fill(m.reserved, { n: v.reserved })}</Badge>}
                        {v.archived && <Badge>{m.hidden}</Badge>}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            );
            return (
              <li key={p.id}>
                {canWrite ? (
                  <Link href={`/dashboard/products/${p.id}`} className="block">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
