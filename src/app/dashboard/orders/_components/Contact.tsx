import { Icon } from "@/components/Icon";
import { cx } from "@/components/ui";
import { whatsappLink } from "@/lib/format";

const button = "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[var(--radius)] border border-stone-300 bg-white px-4 text-sm font-medium hover:bg-stone-50";

/** Call and WhatsApp the customer in one tap. */
export function ContactButtons({ phone, call, whatsapp, className }: { phone: string; call: string; whatsapp: string; className?: string }) {
  return (
    <div className={cx("flex gap-2", className)}>
      <a href={`tel:${phone}`} className={button}>
        <Icon name="phone" />
        {call}
      </a>
      <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" className={cx(button, "text-emerald-800")}>
        <Icon name="chat" />
        {whatsapp}
      </a>
    </div>
  );
}
