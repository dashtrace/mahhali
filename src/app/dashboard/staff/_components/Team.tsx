"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Select } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { ShopMessages } from "@/i18n/messages/shop";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { CopyLink } from "../../_components/Board";
import { submitWith, useAction } from "../../products/_components/useAction";

type Role = "owner" | "manager" | "staff" | "delivery";
type Ref = { id: string; name: string };
type Member = { id: string; userId: string; name: string; email: string; role: string; courier: Ref | null };
type Invitation = { id: string; email: string; role: string | null; expiresAt: string; courier: Ref | null };
type Msgs = { m: ShopMessages; t: CommonMessages };

const INVITABLE = ["manager", "staff", "delivery"] as const;

function roleLabel(role: string | null, t: CommonMessages) {
  return { owner: t.roleOwner, manager: t.roleManager, staff: t.roleStaff, delivery: t.roleDelivery }[role as Role] ?? role ?? "";
}

/** Role picker, plus the courier picker a delivery user needs. */
function RoleFields({ role, courierId, couriers, m, t, onRole }: { role: string; courierId?: string; couriers: Ref[]; onRole: (r: string) => void } & Msgs) {
  const hint = { manager: m.roleHintManager, staff: m.roleHintStaff, delivery: m.roleHintDelivery }[role as (typeof INVITABLE)[number]];
  return (
    <>
      <Field label={m.role} hint={hint}>
        <Select name="role" value={role} onChange={(e) => onRole(e.target.value)}>
          {INVITABLE.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r, t)}
            </option>
          ))}
        </Select>
      </Field>
      {role === "delivery" &&
        (couriers.length ? (
          <Field label={m.courier}>
            <Select name="courierId" defaultValue={courierId ?? ""} required>
              <option value="" disabled>
                {m.pickCourier}
              </option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Alert tone="warning">{m.needCourier}</Alert>
        ))}
    </>
  );
}

export function Team({ members, invitations, couriers, meId, locale, m, t }: { members: Member[]; invitations: Invitation[]; couriers: Ref[]; meId: string; locale: Locale } & Msgs) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{m.members}</h2>
        {members.map((mem) => (
          <MemberCard key={mem.id} member={mem} isMe={mem.userId === meId} couriers={couriers} m={m} t={t} />
        ))}
      </section>
      <InviteForm couriers={couriers} m={m} t={t} />
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{m.pending}</h2>
        {invitations.length === 0 ? (
          <EmptyState title={m.noPending} />
        ) : (
          invitations.map((inv) => <InviteRow key={inv.id} invite={inv} locale={locale} m={m} t={t} />)
        )}
      </section>
    </div>
  );
}

function MemberCard({ member, isMe, couriers, m, t }: { member: Member; isMe: boolean; couriers: Ref[] } & Msgs) {
  const [role, setRole] = useState(member.role);
  const action = useAction(t.error);
  const locked = member.role === "owner" || isMe;
  // A courier they act for may since have been deactivated; keep it pickable.
  const options = member.courier && !couriers.some((c) => c.id === member.courier!.id) ? [...couriers, member.courier] : couriers;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {member.name} {isMe && <span className="text-sm text-stone-500">({m.you})</span>}
          </p>
          <p className="truncate text-sm text-stone-600" dir="ltr">
            {member.email}
          </p>
        </div>
        <Badge tone={member.role === "owner" ? "violet" : "neutral"}>{roleLabel(member.role, t)}</Badge>
        {member.courier && <Badge tone="blue">{member.courier.name}</Badge>}
      </div>
      {!locked && (
        <form
          key={`${member.role}|${member.courier?.id}`}
          onSubmit={submitWith((f) =>
            action.run(() =>
              api(`/api/staff/${member.id}`, {
                method: "PATCH",
                body: { role, courierId: role === "delivery" ? String(f.get("courierId") ?? "") || null : null },
              }),
            ),
          )}
          className="flex flex-col gap-3"
        >
          {action.error && <Alert tone="error">{action.error}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <RoleFields role={role} courierId={member.courier?.id} couriers={options} onRole={setRole} m={m} t={t} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" tone="secondary" disabled={action.busy}>
              {action.busy ? t.saving : t.save}
            </Button>
            <Button
              tone="ghost"
              className="text-red-700"
              disabled={action.busy}
              onClick={() => confirm(fill(m.removeConfirm, { name: member.name })) && action.run(() => api(`/api/staff/${member.id}`, { method: "DELETE" }))}
            >
              {m.removeMember}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function InviteForm({ couriers, m, t }: { couriers: Ref[] } & Msgs) {
  const [role, setRole] = useState<string>("staff");
  const [result, setResult] = useState<{ email: string; link: string; emailSent: boolean } | null>(null);
  const action = useAction(t.error);

  async function submit(f: FormData, form: HTMLFormElement) {
    setResult(null);
    const email = String(f.get("email") ?? "").trim();
    const ok = await action.run(async () => {
      const res = await api<{ link: string; emailSent: boolean }>("/api/staff/invites", {
        body: { email, role, ...(role === "delivery" ? { courierId: String(f.get("courierId") ?? "") } : {}) },
      });
      setResult({ email, ...res });
    });
    if (ok) form.reset();
  }

  return (
    <Card>
      <h2 className="mb-3 font-semibold">{m.inviteTitle}</h2>
      <form onSubmit={submitWith(submit)} className="flex flex-col gap-3">
        {action.error && <Alert tone="error">{action.error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={m.email}>
            <Input name="email" type="email" inputMode="email" autoComplete="off" required maxLength={200} dir="ltr" />
          </Field>
          <RoleFields role={role} couriers={couriers} onRole={setRole} m={m} t={t} />
        </div>
        <Button type="submit" className="self-start" disabled={action.busy || (role === "delivery" && couriers.length === 0)}>
          {action.busy ? m.inviting : m.sendInvite}
        </Button>
      </form>
      {result && (
        <div className="mt-3">
          <Alert tone={result.emailSent ? "success" : "warning"}>
            {result.emailSent ? fill(m.inviteSent, { email: result.email }) : m.inviteEmailFailed}
          </Alert>
          <CopyLink url={result.link} label={m.inviteLink} copy={m.copyLink} copied={m.copied} />
        </div>
      )}
    </Card>
  );
}

function InviteRow({ invite, locale, m, t }: { invite: Invitation; locale: Locale } & Msgs) {
  const action = useAction(t.error);
  return (
    <Card className="flex flex-col gap-2">
      {action.error && <Alert tone="error">{action.error}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-medium" dir="ltr">
          {invite.email}
        </p>
        <Badge>{roleLabel(invite.role, t)}</Badge>
        {invite.courier && <Badge tone="blue">{invite.courier.name}</Badge>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-stone-600">{fill(m.expires, { date: formatDate(invite.expiresAt, locale) })}</span>
        <Button
          tone="ghost"
          disabled={action.busy}
          onClick={() => confirm(fill(m.revokeConfirm, { email: invite.email })) && action.run(() => api(`/api/staff/invites/${invite.id}`, { method: "DELETE" }))}
        >
          {m.revoke}
        </Button>
      </div>
    </Card>
  );
}
