"use client";

import { useState } from "react";
import { Alert } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { ShopMessages } from "@/i18n/messages/shop";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { CopyLink } from "../../_components/Board";
import { DashIcon } from "../../_components/DashIcon";
import { Dialog, Field } from "../../products/_components/kit";
import { submitWith, useAction, useSave } from "../../products/_components/useAction";

type Role = "owner" | "manager" | "staff" | "delivery";
type Ref = { id: string; name: string };
type Member = { id: string; userId: string; name: string; email: string; role: string; courier: Ref | null };
type Invitation = { id: string; email: string; role: string | null; expiresAt: string; expired: boolean; courier: Ref | null };
type Msgs = { m: ShopMessages; t: CommonMessages };

const INVITABLE = ["manager", "staff", "delivery"] as const;

function roleLabel(role: string | null, t: CommonMessages) {
  return { owner: t.roleOwner, manager: t.roleManager, staff: t.roleStaff, delivery: t.roleDelivery }[role as Role] ?? role ?? "";
}

/** Role picker, plus the courier picker a delivery user needs. */
function RoleFields({ role, courierId, couriers, m, t, onRole }: { role: string; courierId?: string; couriers: Ref[]; onRole: (r: string) => void } & Msgs) {
  return (
    <>
      <Field label={m.role}>
        <select name="role" className="control" value={role} onChange={(e) => onRole(e.target.value)}>
          {INVITABLE.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r, t)}
            </option>
          ))}
        </select>
      </Field>
      {role === "delivery" &&
        (couriers.length ? (
          <Field label={m.courier}>
            <select name="courierId" className="control" defaultValue={courierId ?? ""} required>
              <option value="" disabled>
                {m.pickCourier}
              </option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="callout mt-0">{m.needCourier}</div>
        ))}
    </>
  );
}

/** Where the invite email failed or the owner wants to share by hand. */
function InviteResult({ result, m }: { result: { email: string; link: string; emailSent: boolean } | null; m: ShopMessages }) {
  if (!result) return null;
  return (
    <div className="mt-3">
      <Alert tone={result.emailSent ? "success" : "warning"}>{result.emailSent ? fill(m.inviteSent, { email: result.email }) : m.inviteEmailFailed}</Alert>
      <CopyLink url={result.link} label={m.inviteLink} copy={m.copyLink} copied={m.copied} />
    </div>
  );
}

export function Team({ members, invitations, couriers, meId, locale, m, t }: { members: Member[]; invitations: Invitation[]; couriers: Ref[]; meId: string; locale: Locale } & Msgs) {
  return (
    <>
      <div className="info-inline mb-4">
        <DashIcon name="info" size="sm" /> <b>{t.roleManager}</b>: {m.roleHintManager} <b>{t.roleStaff}</b>: {m.roleHintStaff} <b>{t.roleDelivery}</b>: {m.roleHintDelivery} <b>{t.roleOwner}</b>: {m.roleHintOwner}
      </div>
      <section className="card">
        <h2>
          {m.members} ({members.length})
        </h2>
        {members.map((mem) => (
          <MemberRow key={mem.id} member={mem} isMe={mem.userId === meId} couriers={couriers} m={m} t={t} />
        ))}
      </section>
      <InviteForm couriers={couriers} m={m} t={t} />
      <section className="card">
        <h2>{m.pending}</h2>
        {invitations.length === 0 ? <div className="empty">{m.noPending}</div> : invitations.map((inv) => <InviteRow key={inv.id} invite={inv} locale={locale} m={m} t={t} />)}
      </section>
    </>
  );
}

function MemberRow({ member, isMe, couriers, m, t }: { member: Member; isMe: boolean; couriers: Ref[] } & Msgs) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(member.role);
  const action = useSave(t.error, role);
  const locked = member.role === "owner" || isMe;
  // A courier they act for may since have been deactivated; keep it pickable.
  const options = member.courier && !couriers.some((c) => c.id === member.courier!.id) ? [...couriers, member.courier] : couriers;

  return (
    <div className="line-item items-start">
      <div className="flex min-w-0 items-start gap-[9px]">
        <div aria-hidden className="merchant-logo" style={{ width: 34, height: 34, font: "700 14px Arial", color: "#185f7c", background: "#ebf5f7" }}>
          {member.name.trim().slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <b className="break-words">{member.name}</b>
          {isMe && ` (${m.you})`}
          <p className="hint mt-1 mb-0 break-all">
            <bdi dir="ltr">{member.email}</bdi>
          </p>
          <span className="mini-badge gray">{roleLabel(member.role, t)}</span>{" "}
          {member.courier && <span className="mini-badge">{fill(m.courierBadge, { name: member.courier.name })}</span>}
        </div>
      </div>
      {locked ? (
        <span className="hint shrink-0">{m.fullAccess}</span>
      ) : (
        <button
          type="button"
          className="btn tiny shrink-0"
          onClick={() => {
            setRole(member.role);
            setOpen(true);
          }}
        >
          {m.manageAccess}
        </button>
      )}
      {open && (
        <Dialog title={fill(m.accessFor, { name: member.name })} closeLabel={t.close} onClose={() => setOpen(false)}>
          <p className="hint">{m.accessHint}</p>
          <form
            key={`${member.role}|${member.courier?.id}`}
            {...action.form}
            onSubmit={submitWith(async (f) => {
              const saved = await action.save(() =>
                api(`/api/staff/${member.id}`, {
                  method: "PATCH",
                  body: { role, courierId: role === "delivery" ? String(f.get("courierId") ?? "") || null : null },
                }),
              );
              if (saved) setOpen(false);
            })}
          >
            {action.error && <Alert tone="error" className="mb-3">{action.error}</Alert>}
            <RoleFields role={role} courierId={member.courier?.id} couriers={options} onRole={setRole} m={m} t={t} />
            <div className="actions">
              <button type="submit" className="btn primary" disabled={action.busy || !action.dirty}>
                {action.busy ? t.saving : m.saveAccess}
              </button>
              <button
                type="button"
                className="btn warn"
                disabled={action.busy}
                onClick={() => confirm(fill(m.removeConfirm, { name: member.name })) && action.run(() => api(`/api/staff/${member.id}`, { method: "DELETE" }))}
              >
                {m.removeMember}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
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
    <section className="card">
      <h2>{m.inviteTitle}</h2>
      <form onSubmit={submitWith(submit)}>
        {action.error && <Alert tone="error" className="mb-3">{action.error}</Alert>}
        <div className="split gap-y-0">
          <Field label={m.emailAddress}>
            <input name="email" type="email" inputMode="email" autoComplete="off" required maxLength={200} dir="ltr" placeholder="person@example.com" className="control" />
          </Field>
          <RoleFields role={role} couriers={couriers} onRole={setRole} m={m} t={t} />
        </div>
        <p className="hint">{m.inviteHint}</p>
        <button type="submit" className="btn primary" disabled={action.busy || (role === "delivery" && couriers.length === 0)}>
          {action.busy ? m.inviting : m.sendInvite}
        </button>
      </form>
      <InviteResult result={result} m={m} />
    </section>
  );
}

function InviteRow({ invite, locale, m, t }: { invite: Invitation; locale: Locale } & Msgs) {
  const [result, setResult] = useState<{ email: string; link: string; emailSent: boolean } | null>(null);
  const action = useAction(t.error);
  const date = formatDate(invite.expiresAt, locale);

  function reinvite() {
    setResult(null);
    return action.run(async () => {
      const res = await api<{ link: string; emailSent: boolean }>("/api/staff/invites", {
        body: { email: invite.email, role: invite.role, ...(invite.courier ? { courierId: invite.courier.id } : {}) },
      });
      setResult({ email: invite.email, ...res });
    });
  }

  return (
    <div>
      {action.error && <Alert tone="error" className="mb-3">{action.error}</Alert>}
      <div className="line-item max-[780px]:flex-wrap">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-[9px]">
            <b className="min-w-0 break-all">
              <bdi dir="ltr">{invite.email}</bdi>
            </b>
            {invite.expired && <span className="mini-badge red">{m.expired}</span>}
          </div>
          <p className="hint mt-1 mb-0">
            {[fill(m.pendingAs, { role: roleLabel(invite.role, t) }), invite.courier && fill(m.courierBadge, { name: invite.courier.name }), fill(invite.expired ? m.expiredOn : m.expires, { date })].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="actions shrink-0 justify-end">
          {invite.expired && (
            <button type="button" className="btn tiny primary" disabled={action.busy} onClick={reinvite}>
              {m.inviteAgain}
            </button>
          )}
          <button
            type="button"
            className="btn tiny"
            disabled={action.busy}
            onClick={() => confirm(fill(m.revokeConfirm, { email: invite.email })) && action.run(() => api(`/api/staff/invites/${invite.id}`, { method: "DELETE" }))}
          >
            {m.revoke}
          </button>
        </div>
      </div>
      <InviteResult result={result} m={m} />
    </div>
  );
}
