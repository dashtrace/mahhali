import { withRoute } from "@/server/http/withRoute";

export const GET = withRoute({ access: { kind: "public" } }, async () => ({ ok: true }));
