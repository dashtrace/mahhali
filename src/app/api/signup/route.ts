import { withRoute } from "@/server/http/withRoute";
import { signUpBusiness } from "@/server/services/signupService";
import { SignupBody } from "@/server/validation/signup";

export const POST = withRoute({ access: { kind: "public" }, body: SignupBody }, ({ body }) =>
  signUpBusiness(body),
);
