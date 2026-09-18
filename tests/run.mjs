/*
 * 画面ごしの試験をまとめて走らせる。
 *
 * 使いかた:
 *   Chrome を --remote-debugging-port=9222 で立てておく
 *   npm run dev を 3000 番で走らせておく（開発用の抜け道が要る試験があるため）
 *   node tests/run.mjs            すべて
 *   node tests/run.mjs indent     名前に indent を含むものだけ
 */
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const only = process.argv[2];
const prisma = new PrismaClient();

const seed = () => execFileSync("npm", ["run", "seed"], { stdio: "ignore" });

async function keyFor(name) {
  const user = await prisma.user.findFirst({ where: { name } });
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: { token, userId: user.id, expires: new Date(Date.now() + 864e5) },
  });
  return token;
}

async function slipId() {
  const user = await prisma.user.findFirst({ where: { name: "はなこ" } });
  const slip = await prisma.slip.findFirst({ where: { authorId: user.id, shares: { some: {} } } });
  return slip.id;
}

const files = readdirSync("tests")
  .filter((f) => f.startsWith("e2e-") && f.endsWith(".mjs"))
  .filter((f) => !only || f.includes(only))
  .sort();

/** 前の試験がこけて残した頁を閉じる。溜まると Chrome が重くなり、次の試験が時間切れになる。 */
async function sweep() {
  try {
    const pages = await (await fetch("http://127.0.0.1:9222/json")).json();
    for (const p of pages) if (p.type === "page") await fetch(`http://127.0.0.1:9222/json/close/${p.id}`).catch(() => {});
  } catch {}
}

let failed = 0;
for (const file of files) {
  await sweep();
  seed();
  // 試験ごとに要るものが違うので、ここで揃えて渡す
  const args = [];
  const needs = file.replace("e2e-", "").replace(".mjs", "");
  if (["scroll", "keyboard", "paper", "namechange", "limit", "indent", "reading", "caret"].includes(needs))
    args.push(await keyFor("はなこ"));
  if (["url", "tategaki", "share", "tap"].includes(needs)) args.push(await keyFor("はなこ"), await slipId());
  if (needs === "rename") args.push(await keyFor("はなこ"), await keyFor("たろう"));

  const env = { ...process.env };
  if (["open", "shortcut", "wrap", "marks", "fresh", "hitbox"].includes(needs)) env.TOK = await keyFor("はなこ");

  let out = "";
  try {
    out = execFileSync("node", [`tests/${file}`, ...args], { env, encoding: "utf8" });
  } catch (e) {
    out = (e.stdout ?? "") + (e.stderr ?? "");
    failed++;
  }
  const last = out.trim().split("\n").pop() ?? "（応答なし）";
  console.log(`${needs.padEnd(12)} ${last}`);
}

await prisma.$disconnect();
console.log(failed ? `\n${failed} 本こけました` : `\n${files.length} 本すべて通りました`);
process.exit(failed ? 1 : 0);
