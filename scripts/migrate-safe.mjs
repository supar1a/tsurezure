// build のときの migrate を、行き先を確かめてから流す。
// Preview（本番以外の branch）の build が本番の表に migration を流した事故（2026-09-15）を二度と起こさないため。
import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV ?? "local";
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "";
const schema = new URL(url.replace(/^postgres(ql)?:/, "http:")).searchParams.get("schema") ?? "public";

if (env === "preview" && schema === "public") {
  console.error(`migrate を止めました: Preview の build が本番の表（schema=public）に向いています。branch 用の DATABASE_URL を設定してください。`);
  process.exit(1);
}
console.log(`migrate deploy → ${env} / schema=${schema}`);
execSync("npx prisma migrate deploy", { stdio: "inherit" });
