import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Adds .openapi() to every schema so docs/openapi.yaml is generated from the
// same schemas the routes validate with.
extendZodWithOpenApi(z);

export { z };
