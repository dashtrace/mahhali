import type { CommonMessages } from "@/i18n/messages/common";
import type { OrderMessages } from "@/i18n/messages/orders";
import { GOVERNORATES } from "@/server/domain/lebanon";
import { Field } from "./Field";
import { govLabel } from "./labels";

export type AddressValue = { governorate: string; district: string; area: string; addressLine: string; landmark: string | null };

/** Lebanese address inputs (no postcode); read back with addressFrom(FormData). */
export function AddressFields({ value, m, t }: { value?: AddressValue; m: OrderMessages; t: CommonMessages }) {
  return (
    <div className="split gap-y-0">
      <Field label={m.governorate}>
        <select name="governorate" required defaultValue={value?.governorate ?? ""} className="control">
          <option value="" disabled>
            {m.choose}
          </option>
          {GOVERNORATES.map((g) => (
            <option key={g} value={g}>
              {govLabel(m, g)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={m.district}>
        <input name="district" required maxLength={60} defaultValue={value?.district} className="control" />
      </Field>
      <Field label={m.area}>
        <input name="area" required maxLength={80} defaultValue={value?.area} className="control" />
      </Field>
      <Field label={m.addressLine}>
        <input name="addressLine" required maxLength={200} defaultValue={value?.addressLine} className="control" />
      </Field>
      <Field label={`${m.landmark} (${t.optional})`} className="col-span-full">
        <input name="landmark" maxLength={200} defaultValue={value?.landmark ?? ""} className="control" />
      </Field>
    </div>
  );
}

export function addressFrom(form: FormData) {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  return { governorate: get("governorate"), district: get("district"), area: get("area"), addressLine: get("addressLine"), landmark: get("landmark") || null };
}
