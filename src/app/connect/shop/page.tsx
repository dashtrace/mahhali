import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { common } from "@/i18n/messages/common";
import { connectMessages } from "@/i18n/messages/connect";
import { getLocale } from "@/i18n/server";
import { currentUser } from "@/server/http/session";
import { connectService } from "@/server/services/connectService";
import { AuthFrame } from "../../_platform/Shell";
import { ShopPicker } from "./ShopPicker";

export const metadata: Metadata = { title: "Connect an assistant" };

// Step of connecting an AI assistant: members of several shops pick the one it will use.
export default async function ConnectShopPage() {
  const locale = await getLocale();
  const m = connectMessages[locale];
  const user = await currentUser(await headers());
  if (!user) redirect("/login");
  const shops = await connectService.shops({ userId: user.id });
  if (shops.length === 0) {
    return (
      <AuthFrame locale={locale} icon="shield" center title={m.noShopsTitle} subtitle={m.noShopsBody}>
        <SignOutButton label={common[locale].signOut} className="justify-center" />
      </AuthFrame>
    );
  }
  const c = common[locale];
  const roleLabel = { owner: c.roleOwner, manager: c.roleManager, staff: c.roleStaff, delivery: c.roleDelivery };
  return (
    <AuthFrame locale={locale} icon="shield" title={m.pickTitle} subtitle={m.pickSubtitle}>
      <ShopPicker
        shops={shops.map((s) => ({ id: s.shopId, name: s.name, role: roleLabel[s.role] }))}
        m={m}
      />
    </AuthFrame>
  );
}
