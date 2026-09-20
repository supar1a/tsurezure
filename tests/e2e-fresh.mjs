// 札の朱の点：最後に見た時刻より後に、ほかの人が投げていれば付く。ひらけば消える。数は出さない。
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const tok = process.env.TOK;
const version = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const ws = new WebSocket(version.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let seq = 0; const waiters = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } };
const send = (method, params = {}, sid) => new Promise((res, rej) => { const id = ++seq; waiters.set(id, (m) => (m.error ? rej(new Error(method)) : res(m.result))); ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId); await send("Runtime.enable", {}, sessionId); await send("Network.enable", {}, sessionId);
await send("Network.setCookie", { name: "tsurezure", value: tok, domain: "localhost", path: "/" }, sessionId);
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)).result.value;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const goto = async (u) => { await send("Page.navigate", { url: u }, sessionId); await wait(2600); };
const dots = () => ev(`[...document.querySelectorAll(".book")].map(b => (b.querySelector(".book-fresh") ? "●" : "○") + b.querySelector(".book-name").textContent.replace("新しいものがあります", "").trim())`);
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 200)));

const hanako = await prisma.user.findFirst({ where: { name: "はなこ" } });
const taro = await prisma.user.findFirst({ where: { name: "たろう" } });
const sannin = await prisma.place.findFirst({ where: { slug: "sannin" } });

// まだ一度も見ていない：付けない
await prisma.membership.updateMany({ where: { userId: hanako.id }, data: { lastReadAt: null } });
await goto("http://localhost:3000/");
check("一度も見ていない札には付けない", !(await dots()).some((d) => d.startsWith("●")), JSON.stringify(await dots()));

// 見たあとに、たろうが投げた：付く
await prisma.membership.updateMany({ where: { userId: hanako.id }, data: { lastReadAt: new Date(Date.now() - 60000) } });
await prisma.slip.create({ data: { authorId: taro.id, body: "見たあとに、たろうが書いた一枚。", shares: { create: { placeId: sannin.id } } } });
await goto("http://localhost:3000/");
check("見たあとにほかの人が投げた札には、朱の点が付く", (await dots()).includes("●三人のところ"), JSON.stringify(await dots()));
check("ひとりのスペースには付けない", !(await dots()).includes("●ひとりのスペース"), JSON.stringify(await dots()));
check("点だけで、数は出さない", !/\d|[一二三四五六七八九十]件/.test(await ev(`document.querySelector(".book-fresh")?.parentElement?.textContent ?? ""`)));

// ひらけば消える
await goto("http://localhost:3000/sannin"); await wait(1500);
await goto("http://localhost:3000/");
check("そのスペースをひらけば消える", !(await dots()).includes("●三人のところ"), JSON.stringify(await dots()));

// 自分が投げただけでは付かない
await prisma.slip.create({ data: { authorId: hanako.id, body: "自分で投げた一枚。", shares: { create: { placeId: sannin.id } } } });
await goto("http://localhost:3000/");
check("自分の投稿では付かない", !(await dots()).includes("●三人のところ"), JSON.stringify(await dots()));

await prisma.$disconnect();
await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
// すぐ exit すると、pipe に出した結果が途中で切れることがある。少し待ってから終える
process.exitCode = bad.length ? 1 : 0; setTimeout(() => process.exit(), 300);
