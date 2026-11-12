import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";

// Sign-in and sign-out from the browser; sign-up goes through /api/signup.
// oauthProviderClient passes the signed OAuth query along when a page is part
// of connecting an AI assistant (/login, /connect/*), so the flow can resume.
export const authClient = createAuthClient({ plugins: [oauthProviderClient()] });

/** A step of the OAuth flow answered { redirect, url }: go there. Returns false if it did not. */
export function followOAuthRedirect(data: unknown): boolean {
  if (data && typeof data === "object" && "url" in data && typeof data.url === "string" && data.url) {
    window.location.assign(data.url);
    return true;
  }
  return false;
}
