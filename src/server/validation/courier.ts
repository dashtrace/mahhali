import { Phone } from "./common";
import { z } from "./zod";

const CourierType = z.enum(["COMPANY", "INDIVIDUAL"]).openapi("CourierType");
const name = z.string().trim().min(1).max(80);

export const CreateCourierBody = z
  .object({ name, type: CourierType, phone: Phone.nullable().optional() })
  .openapi("CreateCourierBody");

export const UpdateCourierBody = z
  .object({
    name: name.optional(),
    type: CourierType.optional(),
    phone: Phone.nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Send at least one field to change")
  .openapi("UpdateCourierBody");

export const ListCouriersQuery = z.object({
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export type CreateCourierInput = z.infer<typeof CreateCourierBody>;
export type UpdateCourierInput = z.infer<typeof UpdateCourierBody>;
