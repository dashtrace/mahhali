import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/auth";

// Better Auth's own endpoints (sign in, sign out, session, invitations).
// The library validates these requests itself.
export const { GET, POST } = toNextJsHandler(auth);
