import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { connectMessages } from "@/i18n/messages/connect";
import { getLocale } from "@/i18n/server";
import { AppError } from "@/server/http/errors";
import { currentUser } from "@/server/http/session";
import { connectService } from "@/server/services/connectService";
import { AuthFrame } from "../../_platform/Shell";
import { ConsentForm } from "./ConsentForm";

export const metadata: Metadata = { title: "Connect an assistant" };

type Search = Record<string, string | string[] | undefined>;

// Last step of connecting an AI assistant: what it asks for, for which shop, as which role.
export default async function ConsentPage({ searchParams }: { searchParams: Promise<Search> }) {
  const locale = await getLocale();
  const m = connectMessages[locale];
  const h = await headers();
  const user = await currentUser(h);
  if (!user) redirect("/login");

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, v);
  }
  let details;
  try {
    details = await connectService.consentDetails({ userId: user.id }, h, query);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return (
      <AuthFrame locale={locale} icon="shield" center title={m.noShopsTitle}>
        <Alert tone="error">{m.expired}</Alert>
      </AuthFrame>
    );
  }

  const c = common[locale];
  const role = { owner: c.roleOwner, manager: c.roleManager, staff: c.roleStaff, delivery: c.roleDelivery }[details.role];
  const label = {
    "orders:read": m.scopeOrdersRead,
    "catalogue:read": m.scopeCatalogueRead,
    "catalogue:write": m.scopeCatalogueWrite,
    "finance:read": m.scopeFinanceRead,
  };
  return (
    <AuthFrame
      locale={locale}
      icon="shield"
      title={fill(m.consentTitle, { app: details.client.name, shop: details.shop.name })}
      subtitle={fill(m.consentSubtitle, { app: details.client.name, role })}
      footer={m.consentRevoke}
    >
      <ConsentForm scopes={details.scopes.map((id) => ({ id, label: label[id as keyof typeof label] ?? id }))} m={m} />
    </AuthFrame>
  );
}
