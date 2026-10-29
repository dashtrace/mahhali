import { auth } from "../auth/auth";
import { AppError, conflict } from "../http/errors";
import { json } from "../http/json";
import { shopRepo } from "../repositories/shopRepo";
import { isUniqueViolation, transaction } from "../repositories/tx";
import { userRepo } from "../repositories/userRepo";
import type { SignupInput } from "../validation/signup";

/**
 * A business signs up: creates the owner account, then the shop with the owner
 * as its first member. Returns the session cookie so the owner is signed in.
 */
export async function signUpBusiness(input: SignupInput): Promise<Response> {
  if (await shopRepo.slugTaken(input.shopSlug)) {
    throw conflict("SLUG_TAKEN", "That shop link is already taken.");
  }

  const authResponse = await auth.api.signUpEmail({
    body: { name: input.name, email: input.email, password: input.password },
    asResponse: true,
  });
  const authBody = (await authResponse.json().catch(() => null)) as
    | { user?: { id: string; email: string; name: string }; code?: string; message?: string }
    | null;
  if (!authResponse.ok || !authBody?.user) {
    if (authBody?.code === "USER_ALREADY_EXISTS" || authBody?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
      throw conflict("EMAIL_TAKEN", "An account with this email already exists.");
    }
    throw new AppError(authResponse.status, authBody?.code ?? "SIGNUP_FAILED", authBody?.message ?? "Sign-up failed.");
  }
  const user = authBody.user;

  let shop;
  try {
    shop = await transaction((tx) =>
      shopRepo.createWithOwner(tx, {
        id: crypto.randomUUID(),
        name: input.shopName,
        slug: input.shopSlug,
        currency: input.currency,
        usdLbpRate: input.usdLbpRate,
        baselineOrdersPerDay: input.baselineOrdersPerDay,
        baselineConfirmMinutes: input.baselineConfirmMinutes,
        userId: user.id,
      }),
    );
  } catch (error) {
    await userRepo.deleteById(user.id);
    if (isUniqueViolation(error)) {
      throw conflict("SLUG_TAKEN", "That shop link is already taken.");
    }
    throw error;
  }

  const headers = new Headers();
  for (const cookie of authResponse.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return json(
    {
      user: { id: user.id, email: user.email, name: user.name },
      shop: { id: shop.id, name: shop.name, slug: shop.slug, currency: shop.currency },
      role: "owner",
    },
    201,
    headers,
  );
}
