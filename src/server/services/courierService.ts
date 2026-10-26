import { notFound } from "../http/errors";
import type { Actor } from "../http/withRoute";
import { courierRepo } from "../repositories/courierRepo";
import type { CreateCourierInput, UpdateCourierInput } from "../validation/courier";

// Delivery companies and people a shop hands orders to. Old orders keep their
// courier, so couriers are deactivated rather than deleted.
export const courierService = {
  list(actor: Actor, opts: { active?: boolean }) {
    return courierRepo.list(actor.shopId, opts);
  },

  create(actor: Actor, input: CreateCourierInput) {
    return courierRepo.create(actor.shopId, { name: input.name, type: input.type, phone: input.phone ?? null });
  },

  async update(actor: Actor, id: string, input: UpdateCourierInput) {
    const courier = await courierRepo.update(actor.shopId, id, input);
    if (!courier) throw notFound("Courier");
    return courier;
  },
};
