import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { common } from "@/i18n/messages/common";
import { orderMessages } from "@/i18n/messages/orders";
import { getLocale } from "@/i18n/server";
import { itemLabel } from "@/server/domain/orders";
import { can } from "@/server/domain/policy";
import { accountService } from "@/server/services/accountService";
import { productService } from "@/server/services/productService";
import { pageActor } from "../../../_server/session";
import { NewOrderForm } from "../_components/NewOrderForm";

export const metadata = { title: "New order" };

export default async function NewOrderPage() {
  const actor = await pageActor("order.create", "/dashboard/orders/new");
  const locale = await getLocale();
  const m = orderMessages[locale];
  const t = common[locale];
  const [me, products] = await Promise.all([accountService.me(actor), productService.list(actor, { includeArchived: false })]);
  const variants = products.flatMap((p) =>
    p.variants
      .filter((v) => !v.archived)
      .map((v) => ({
        id: v.id,
        label: itemLabel(p.name, v.size, v.colour),
        priceMinor: Number(v.priceMinor),
        available: v.available,
        // The same customization rules the storefront enforces (the API checks them too).
        custom: p.customLabel
          ? { label: p.customLabel, placeholder: p.customPlaceholder, required: p.customRequired, maxLength: p.customMaxLength }
          : null,
      })),
  );

  return (
    <>
      <PageHeader back={{ href: "/dashboard", label: m.boardTitle }} title={m.newOrder} subtitle={m.newOrderSubtitle} />
      {variants.length ? (
        <NewOrderForm variants={variants} currency={me.shop.currency} locale={locale} m={m} t={t} />
      ) : (
        <EmptyState
          title={m.noProducts}
          action={can(actor.role, "product.write") && <ButtonLink href="/dashboard/products">{m.addProduct}</ButtonLink>}
        />
      )}
    </>
  );
}
