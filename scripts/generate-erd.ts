import { writeFileSync } from "node:fs";
import { Prisma } from "@prisma/client";

// Writes docs/erd.md from the Prisma schema, so the ERD can never drift from the database.
const models = Prisma.dmmf.datamodel.models;
const table = (name: string) => name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();

const lines: string[] = ["erDiagram"];
for (const model of models) {
  for (const field of model.fields) {
    if (field.kind !== "object" || !field.relationFromFields?.length) continue;
    const target = models.find((m) => m.name === field.type)!;
    const back = target.fields.find((f) => f.relationName === field.relationName && f.name !== field.name);
    const many = back?.isList ?? true;
    const optional = !field.isRequired;
    const left = optional ? "|o" : "||";
    const right = many ? "o{" : "o|";
    lines.push(`  ${table(target.name)} ${left}--${right} ${table(model.name)} : "${field.relationFromFields.join(", ")}"`);
  }
}
for (const model of models) {
  lines.push(`  ${table(model.name)} {`);
  for (const field of model.fields) {
    if (field.kind === "object") continue;
    const keys = [
      field.isId ? "PK" : null,
      models.some((m) => m.fields.some((f) => f.relationFromFields?.includes(field.name) && m.name === model.name)) ? "FK" : null,
      field.isUnique ? "UK" : null,
    ].filter(Boolean);
    const type = field.kind === "enum" ? "enum" : field.type.toLowerCase();
    lines.push(`    ${type} ${field.name}${keys.length ? " " + keys.join(", ") : ""}`);
  }
  lines.push("  }");
}

const doc = `# Entity relationship diagram

Generated from \`prisma/schema.prisma\` by \`npm run erd\`. Do not edit by hand.

Every table except the Better Auth tables (\`USER\`, \`SESSION\`, \`ACCOUNT\`, \`VERIFICATION\`) and
\`ADMIN_AUDIT_LOG\` belongs to one shop through \`shopId\`. Money columns are \`bigint\`: US dollars in cents,
Lebanese pounds in whole pounds.

Rules the database enforces: unique \`(shopId, number)\` and \`(shopId, idempotencyKey)\` on orders,
unique \`(productId, size, colour)\` on variants, unique \`orderId\` on remittance lines and review invites,
unique \`orderItemId\` on reviews, and CHECK constraints keeping stock and prices at zero or above,
quantities above zero and ratings between 1 and 5.

\`\`\`mermaid
${lines.join("\n")}
\`\`\`
`;
writeFileSync("docs/erd.md", doc);
console.log(`Wrote docs/erd.md (${models.length} tables)`);
