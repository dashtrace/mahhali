import { db, type Db } from "./tx";

export const userRepo = {
  /** Removes a user whose sign-up could not be completed. */
  async deleteById(id: string, client: Db = db) {
    await client.user.deleteMany({ where: { id } });
  },
};
