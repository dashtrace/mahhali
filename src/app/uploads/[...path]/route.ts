import { withRoute } from "@/server/http/withRoute";
import { readUpload, UPLOAD_HEADERS } from "@/server/storage/uploads";
import { z } from "@/server/validation/zod";

// Development and tests. In production Caddy serves /uploads from the volume
// with the same headers (deploy/Caddyfile), so requests never reach this route.
export const GET = withRoute(
  { access: { kind: "public" }, params: z.object({ path: z.array(z.string()) }) },
  async ({ params }) => {
    const file = await readUpload(params.path);
    return new Response(new Uint8Array(file.bytes), { headers: { ...UPLOAD_HEADERS, "content-type": file.contentType } });
  },
);
