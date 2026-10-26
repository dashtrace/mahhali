import { writeFileSync } from "node:fs";
import { buildOpenApi } from "../src/server/validation/openapi";

// Writes docs/openapi.json. CI runs this and fails if the file changed,
// so the committed contract always matches the code.
writeFileSync("docs/openapi.json", JSON.stringify(buildOpenApi(), null, 2) + "\n");
console.log("Wrote docs/openapi.json");
