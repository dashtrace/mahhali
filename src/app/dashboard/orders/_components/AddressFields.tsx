import { Field, Input, Select } from "@/components/ui";
import type { CommonMessages } from "@/i18n/messages/common";
import type { OrderMessages } from "@/i18n/messages/orders";
import { GOVERNORATES } from "@/server/domain/lebanon";
import { govLabel } from "./labels";

export type AddressValue = { governorate: string; district: string; area: string; addressLine: string; landmark: string | null };

/** Lebanese address inputs (no postcode); read back with addressFrom(FormData). */
export function AddressFields({ value, m, t }: { value?: AddressValue; m: OrderMessages; t: CommonMessages }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={m.governorate}>
        <Select name="governorate" required defaultValue={value?.governorate ?? ""}>
          <option value="" disabled>
            {m.choose}
          </option>
          {GOVERNORATES.map((g) => (
            <option key={g} value={g}>
              {govLabel(m, g)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={m.district}>
        <Input name="district" required maxLength={60} defaultValue={value?.district} />
      </Field>
      <Field label={m.area}>
        <Input name="area" required maxLength={80} defaultValue={value?.area} />
      </Field>
      <Field label={m.addressLine}>
        <Input name="addressLine" required maxLength={200} defaultValue={value?.addressLine} />
      </Field>
      <Field label={`${m.landmark} (${t.optional})`} className="sm:col-span-2">
        <Input name="landmark" maxLength={200} defaultValue={value?.landmark ?? ""} />
      </Field>
    </div>
  );
}

export function addressFrom(form: FormData) {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  return { governorate: get("governorate"), district: get("district"), area: get("area"), addressLine: get("addressLine"), landmark: get("landmark") || null };
}
