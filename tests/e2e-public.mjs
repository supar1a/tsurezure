// 一枚を「リンクで公開」する。頁は一つのまま、見る人で出すものが変わる。
//   ・公開していなければ、外の人には見えない（これまで通り）
//   ・本人が公開すると、名乗っていない人も本文だけ読める。スペースの名前も、ほかの一枚も見えない
//   ・やめれば、また見えなくなる
const [, , tok] = process.argv;
const bail = setTimeout(() => { console.log("（時間切れ）"); process.exit(2); }, 150000); bail.unref?.();
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
// 確かめる一枚は自分で探す（題と本文を見るので、どの一枚でもよいわけではない）
const slipId = (await prisma.slip.findFirst({ where: { title: "雨の匂い", shares: { some: {} } } })).id;
const version = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const ws = new WebSocket(version.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let seq = 0; const waiters = new Map(); const listeners = new Set();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } else listeners.forEach((f) => f(m)); };
const send = (method, params = {}, sid) => new Promise((res, rej) => { const id = ++seq; waiters.set(id, (m) => (m.error ? rej(new Error(method + JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId); await send("Network.enable", {}, sessionId); await send("Runtime.enable", {}, sessionId);
listeners.add((m) => { if (m.method === "Page.javascriptDialogOpening" && m.sessionId === sessionId) void send("Page.handleJavaScriptDialog", { accept: true }, sessionId); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)).result.value;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const goto = async (u) => { await send("Page.navigate", { url: u }, sessionId); await wait(2600); };
const asNobody = () => send("Network.clearBrowserCookies", {}, sessionId);
const asUser = async (t) => { await asNobody(); await send("Network.setCookie", { name: "tsurezure", value: t, domain: "localhost", path: "/" }, sessionId); };
const text = () => ev("document.body.innerText");
const path = () => ev("location.pathname");
const press = (label) => ev(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === ${JSON.stringify(label)})?.click()`);
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 200)));
const B = "http://localhost:3000";
const URL_ = `${B}/post/${slipId}`;

// 写真のある一枚（じろうの）も、あとで使う
const withPhoto = await prisma.slip.findFirst({ where: { photo: { isNot: null } }, include: { photo: true } });

// ── 公開していなければ、外の人には見えない ──
await asNobody(); await goto(URL_);
check("公開していない一枚は、名乗っていない人には見えない（入口へ）", (await path()) === "/" && !(await text()).includes("アスファルトが濡れる"), await path());

// ── 本人が公開する ──
await asUser(tok); await goto(URL_);
check("本人には「リンクで公開する」がある", (await text()).includes("リンクで公開する"));
check("はじめは公開中ではない", !(await text()).includes("公開中"));
await press("リンクで公開する"); await wait(2500);
check("押すと「公開中」と出る", (await text()).includes("公開中") && (await text()).includes("公開をやめる"), (await text()).slice(-120));

// ── 名乗っていない人が、本文だけ読める ──
await asNobody(); await goto(URL_);
{
  const t = await text();
  check("名乗っていない人も、その一枚を読める", (await path()) === `/post/${slipId}` && t.includes("アスファルトが濡れる"), await path());
  check("題と書いた人の名前は出る", t.includes("雨の匂い") && t.includes("はなこ"));
  check("スペースの名前は出ない", !t.includes("三人のところ"), t.slice(0, 160));
  check("柱に戻る道は無い（ロゴだけ）", (await ev(`document.querySelectorAll(".masthead-link").length`)) === 0 && !(await ev(`!!document.querySelector(".masthead-sub")`)));
  check("編集・削除・投稿先は出ない", !(await ev(`!!document.querySelector(".sheet-foot")`)));
  check("書いた人の名前は、どこにも飛べない字", (await ev(`document.querySelector(".sheet-who")?.tagName`)) === "SPAN");
  check("左に「つれづれとは」と、始める入口がある", t.includes("つれづれとは") && t.includes("ひとりではじめる"));
  check("頁の題に、その一枚の題が出る", (await ev("document.title")).includes("雨の匂い"), await ev("document.title"));
}

// ほかの一枚は、あいかわらず見えない
{
  const other = await prisma.slip.findFirst({ where: { id: { not: slipId }, shares: { some: {} } } });
  await goto(`${B}/post/${other.id}`);
  check("公開していないほかの一枚は、見えないまま", (await path()) === "/", await path());
  await goto(`${B}/sannin`);
  check("スペースの中身も見えないまま", !(await text()).includes("アスファルトが濡れる"));
}

// ── 仲間でない、名乗っている人 ──
{
  const stranger = await prisma.user.create({ data: { name: "よそもの" } });
  const t = (await import("node:crypto")).randomBytes(32).toString("base64url");
  await prisma.session.create({ data: { token: t, userId: stranger.id, expires: new Date(Date.now() + 864e5) } });
  await asUser(t); await goto(URL_);
  const body = await text();
  check("仲間でない人も本文だけ読める。スペースの名前は出ない", body.includes("アスファルトが濡れる") && !body.includes("三人のところ"));
  check("名乗っている人には、名乗る欄ではなく入口の釦", !body.includes("ひとりではじめる") && body.includes("スペースを作る"));
  await goto(`${URL_}/edit`);
  check("外の人は編集に入れない", !(await ev(`!!document.querySelector(".compose-body")`)));
}

// ── 写真も、公開中の一枚のものだけ ──
if (withPhoto) {
  await asNobody();
  await goto(B + "/");
  const before = await ev(`fetch("/photo/${withPhoto.photo.id}").then(r => r.status)`);
  check("公開していない一枚の写真は、外の人には無い（404）", before === 404, before);
  await prisma.slip.update({ where: { id: withPhoto.id }, data: { open: true } });
  const after = await ev(`fetch("/photo/${withPhoto.photo.id}", { cache: "no-store" }).then(r => r.status)`);
  check("公開すると、その写真は外の人にも出る", after === 200, after);
  await prisma.slip.update({ where: { id: withPhoto.id }, data: { open: false } });
}

// ── やめれば、また見えなくなる ──
await asUser(tok); await goto(URL_);
await press("公開をやめる"); await wait(2500);
check("やめると「公開中」が消える", !(await text()).includes("公開中") && (await text()).includes("リンクで公開する"));
await asNobody(); await goto(URL_);
check("やめたあとは、また外の人には見えない", (await path()) === "/" && !(await text()).includes("アスファルトが濡れる"), await path());

await prisma.$disconnect();
await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
process.exit(bad.length ? 1 : 0);
