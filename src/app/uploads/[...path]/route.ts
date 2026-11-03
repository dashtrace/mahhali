import { withRoute } from "@/server/http/withRoute";
import { readUpload, UPLOAD_HEADERS } from "@/server/storage/uploads";
import { z } from "@/server/validation/zod";

export const GET = withRoute(
  { access: { kind: "public" }, params: z.object({ path: z.array(z.string()) }) },
  async ({ params }) => {
    const file = await readUpload(params.path);
    return new Response(new Uint8Array(file.bytes), { headers: { ...UPLOAD_HEADERS, "content-type": file.contentType } });
  },
);
