import { createAuthClient } from "better-auth/react";

// Sign-in and sign-out from the browser; sign-up goes through /api/signup.
export const authClient = createAuthClient();
