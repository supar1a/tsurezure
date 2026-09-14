// 名前が「つれづれ」で通っているか。
// 表題・頁の題・戸口の印・クッキーの名前、そして前の名前（短冊・交換日記）が残っていないか。
// 前の名前で置いたクッキーは読めたままか（名前を変えたせいで名乗り直しにならないように）。
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const bail = setTimeout(() => { console.log("（時間切れ）"); process.exit(2); }, 150000); bail.unref?.();
const version = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0; const waiters = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } };
const send = (method, params = {}, sid) => new Promise((res, rej) => { const id = ++seq;
  waiters.set(id, (m) => (m.error ? rej(new Error(method + ": " + JSON.stringify(m.error))) : res(m.result)));
  ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId); await send("Runtime.enable", {}, sessionId); await send("Network.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 820, deviceScaleFactor: 1, mobile: false }, sessionId);
const ev = (e) => send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)
  .then((r) => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0,150)); return r.result.value; });
const goto = async (u) => { await send("Page.navigate", { url: u }, sessionId); await new Promise((r) => setTimeout(r, 2400)); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => ev(`document.body.innerText`);
const title = () => ev(`document.title`);
const cookies = async () => (await send("Network.getCookies", { urls: ["http://localhost:3000/"] }, sessionId)).cookies;
const clear = () => send("Network.clearBrowserCookies", {}, sessionId);
const setCookie = (name, value) =>
  send("Network.setCookie", { name, value, url: "http://localhost:3000/", path: "/" }, sessionId);
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 160)));

const B = "http://localhost:3000";
// 前の名前。どの頁の文字にも残っていてはいけない。
const OLD = /短冊|交換日記|tanzaku|kokan/;
// 生の HTML を検めるとき。開発中はエラーの道筋（置き場のフォルダ名 kokan-nikki）がそのまま出るので、そこは見ない。
const OLD_HTML = /短冊|交換日記|tanzaku/;

// 名乗りは自分でこしらえる（この試験は引数を取らない）
const prisma = new PrismaClient();
const hanako = await prisma.user.findFirst({ where: { name: "はなこ" } });
const slip = await prisma.slip.findFirst({ where: { authorId: hanako.id, published: true } });
const token = async () => {
  const t = randomBytes(32).toString("base64url");
  await prisma.session.create({ data: { token: t, userId: hanako.id, expires: new Date(Date.now() + 864e5) } });
  return t;
};

// ── まだ誰でもない人の戸口 ──
await clear();
await goto(B + "/");
check("戸口の頁の題が「つれづれ」", (await title()) === "つれづれ", await title());
check("戸口の印が「つれづれ」", (await ev(`document.querySelector(".gate-mark-title")?.textContent`)) === "つれづれ");
check("html の言語が日本語", (await ev(`document.documentElement.lang`)) === "ja");
check("戸口に前の名前が残っていない", !OLD.test(await text()), (await text()).match(OLD)?.[0]);

await goto(B + "/sannin");
check("招待の頁の題に、グループの名前と「つれづれ」", (await title()) === "三人のところ — つれづれ", await title());
check("招待の頁にも前の名前が残っていない", !OLD.test(await text()), (await text()).match(OLD)?.[0]);

// ── 名乗ったあとの頁を、ひとつずつ ──
await setCookie("tsurezure", await token());
const pages = [
  ["/", "つれづれ"],
  ["/sannin", "三人のところ — つれづれ"],
  ["/sannin?view=maki", "三人のところ — つれづれ"],
  ["/sannin/write", "書く — 三人のところ — つれづれ"],
  ["/sannin/members", null],
  ["/me", "あなたのページ — つれづれ"],
  ["/new", "グループを作る — つれづれ"],
  [`/post/${slip.id}`, "つれづれ"],
  [`/post/${slip.id}/edit`, "編集 — つれづれ"],
];
for (const [path, expected] of pages) {
  await goto(B + path);
  const t = await title();
  if (expected !== null) check(`${path} の題が「${expected}」`, t === expected, t);
  else check(`${path} の題が「つれづれ」で終わる`, t.endsWith("つれづれ"), t);
  check(`${path} の柱の表題が「つれづれ」で、戸口を兼ねる`,
    (await ev(`document.querySelector(".masthead-title")?.textContent?.trim()`)) === "つれづれ"
      && (await ev(`document.querySelector(".masthead-title")?.getAttribute("href")`)) === "/",
    await ev(`document.querySelector(".masthead-title")?.outerHTML?.slice(0, 80)`));
  check(`${path} に前の名前が残っていない`, !OLD.test(await text()), (await text()).match(OLD)?.[0]);
}

// 一篇の頁の名札は「つれづれ」だけ（題もグループ名も出さない）
{
  const r = await fetch(`${B}/post/${slip.id}`);
  const html = await r.text();
  const og = (html.match(/property="og:site_name" content="([^"]*)"/) || [])[1];
  check("名札の場の名が「つれづれ」", og === "つれづれ", og);
  check("名札にも前の名前が残っていない", !OLD_HTML.test(html), html.match(OLD_HTML)?.[0]);
}

// 削除の確かめの言葉も、造語ではなく「投稿」
{
  await goto(`${B}/post/${slip.id}`);
  let asked = "";
  await ev(`window.confirm = (m) => { window.__asked = m; return false; }`);
  await ev(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "削除")?.click()`);
  await wait(300);
  asked = await ev(`window.__asked ?? ""`);
  check("削除の確かめは「この投稿を削除します」", asked.startsWith("この投稿を削除します"), asked);
  check("断れば消えない", (await ev(`location.pathname`)) === `/post/${slip.id}`);
}

// ── クッキーの名前 ──
// 前の名前（tanzaku）で置かれたままの人も、そのまま名乗れている
await clear();
await setCookie("tanzaku", await token());
await goto(B + "/");
check("前の名前のクッキーでも、名乗りが通る", (await text()).includes("はなこ さん"), (await text()).slice(0, 80));
await goto(`${B}/post/${slip.id}`);
check("前の名前のクッキーでも、中が読める", (await text()).includes("アスファルトが濡れる"));

// そこで「消す」と、前の名前のクッキーも一緒に片づく
await goto(B + "/me");
await ev(`window.confirm = () => true`);
await ev(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "消す").click()`);
await wait(2800);
check("消すと、誰でもなくなる", (await text()).includes("はじめまして"), (await text()).slice(0, 80));
{
  const names = (await cookies()).map((c) => c.name);
  check("前の名前のクッキーも残らない", !names.includes("tanzaku") && !names.includes("tsurezure"), JSON.stringify(names));
}

// 新しく名乗ると、クッキーは新しい名前で置かれ、前の名前のものは片づく
await clear();
await setCookie("tanzaku", "ただのごみ");
await goto(B + "/");
check("壊れた古いクッキーでは名乗れず、戸口に出る", (await text()).includes("はじめまして"), (await text()).slice(0, 80));
await ev(`[...document.querySelectorAll(".debug-btn")].find(b => b.textContent.includes("はなこ")).click()`);
await wait(2600);
{
  const cs = await cookies();
  const mine = cs.find((c) => c.name === "tsurezure");
  check("名乗ると「tsurezure」という名前のクッキーが置かれる", !!mine, JSON.stringify(cs.map((c) => c.name)));
  check("そのクッキーは JavaScript から触れない（httpOnly）", mine?.httpOnly === true, JSON.stringify(mine));
  check("sameSite は lax", (mine?.sameSite ?? "").toLowerCase() === "lax", mine?.sameSite);
  check("一年以上もつ", mine && (mine.expires * 1000 - Date.now()) > 365 * 864e5, mine?.expires);
  check("前の名前のクッキーは片づいている", !cs.some((c) => c.name === "tanzaku"), JSON.stringify(cs.map((c) => c.name)));
  check("名乗りが通っている", (await text()).includes("はなこ さん"), (await text()).slice(0, 80));
}

// ── 無いところは、ちゃんと無い ──
{
  const r = await fetch(`${B}/nosuchgroupxyz`);
  check("無いグループは 404", r.status === 404, r.status);
  const p = await fetch(`${B}/photo/nosuchphoto`);
  check("無い写真も 404", p.status === 404, p.status);
}

await prisma.$disconnect();
await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
process.exit(bad.length ? 1 : 0);
