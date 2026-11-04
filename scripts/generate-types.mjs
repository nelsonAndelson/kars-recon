import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const target = process.argv.includes("--local")
  ? ["--local"]
  : [
      "--project-id",
      process.env.SUPABASE_PROJECT_REF ?? "jnrmevlbqshnjsyymtod",
    ];
const result = spawnSync(
  process.execPath,
  [
    "node_modules/supabase/dist/supabase.js",
    "gen",
    "types",
    "typescript",
    ...target,
    "--schema",
    "public",
  ],
  { encoding: "utf8", env: process.env },
);
if (result.status !== 0 || !result.stdout.includes("export type Database")) {
  console.error(result.stderr || result.stdout || "Type generation failed");
  process.exit(1);
}
mkdirSync("src/types", { recursive: true });
writeFileSync("src/types/database.ts", result.stdout, "utf8");
console.log("Generated src/types/database.ts");
