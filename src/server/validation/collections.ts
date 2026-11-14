import { z } from "./zod";
export const CollectionBody = z.object({ name: z.string().trim().min(1).max(40) }).strict().openapi("CollectionBody");
export const UpdateCollectionBody = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  position: z.number().int().min(0).max(29).optional(),
}).strict().refine((v) => v.name !== undefined || v.position !== undefined, "Give a name or position").openapi("UpdateCollectionBody");
