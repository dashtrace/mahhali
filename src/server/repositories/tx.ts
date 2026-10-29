import { Prisma } from "@prisma/client";
import { prisma } from "../db";

/** A database handle: the shared client or an open transaction. */
export type Db = Prisma.TransactionClient;

/** Runs fn in one ACID transaction. Services use this; they never import Prisma. */
export function transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

export { prisma as db };

/** True when a write failed on a unique constraint (Prisma P2002). */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
