import { whatsappLink } from "@/lib/format";
import { DashIcon } from "../../_components/DashIcon";

/** Call and WhatsApp the customer in one tap. */
export function ContactButtons({ phone, call, whatsapp }: { phone: string; call: string; whatsapp: string }) {
  return (
    <div className="actions contact-row">
      <a href={`tel:${phone}`} className="btn tiny">
        <DashIcon name="phone" size="sm" />
        {call}
      </a>
      <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" className="btn tiny">
        <DashIcon name="message" size="sm" />
        {whatsapp}
      </a>
    </div>
  );
}
