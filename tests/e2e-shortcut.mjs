// ⌘（Ctrl）+ Enter で送れるか。変換中は決して送らないか。
// この近道は画面に書いていない。知っている人だけの手癖。
const TOK = process.env.TOK;
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
await send("Network.setCookie", { name: "tsurezure", value: TOK, url: "http://localhost:3000/", path: "/" }, sessionId);
const ev = (e) => send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)
  .then((r) => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0,150)); return r.result.value; });
const goto = async (u) => { await send("Page.navigate", { url: u }, sessionId); await new Promise((r) => setTimeout(r, 2400)); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => ev(`document.body.innerText`);
const path = () => ev(`location.pathname`);
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 160)));

const B = "http://localhost:3000";
const W = `${B}/sannin/write`;

// React に気づかせるには、素の setter で入れてから input を投げる
const put = (sel, v) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) throw new Error("見つからない: " + ${JSON.stringify(sel)} + " @ " + location.pathname);
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, ${JSON.stringify(v)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
  return el.value;
})()`);
// ⌘+Enter は投稿先の窓を開く。そこで投稿するを押して、はじめて送られる
const confirm = async () => { await wait(400); await ev(`document.querySelector("dialog[open] button[type=submit]")?.click()`); };
// 鍵を叩いたことにする。返るのは「既定の動きを止めたか」（＝送りにいったか）
const key = (sel, init) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...${JSON.stringify(init)} });
  el.dispatchEvent(e);
  return e.defaultPrevented;
})()`);

// ── 近道は画面に書いていない ──
await goto(W);
check("書く頁に ⌘ や Ctrl の説明は出ていない", !/⌘|Ctrl|Enter/i.test(await text()), (await text()).match(/⌘|Ctrl|Enter/i)?.[0]);

// ── ⌘ + Enter で送る ──
await put(".compose-body", "近道で書いた一枚");
check("⌘+Enter は送りにいく（改行にしない）", await key(".compose-body", { key: "Enter", metaKey: true }));
await confirm();
await wait(3200);
check("送るとスペースへ戻る", (await path()) === "/sannin", await path());
check("書いたものが目次に載る", (await text()).includes("近道で書いた一枚"), (await text()).slice(0, 120));

// 送られたのは下書きではなく公開
{
  const entry = await ev(`(() => {
    const e = [...document.querySelectorAll(".entry")].find(x => x.textContent.includes("近道で書いた一枚"));
    return e ? { draft: !!e.querySelector(".seal"), who: e.querySelector(".entry-meta")?.textContent ?? "" } : null;
  })()`);
  check("近道で送ったものは公開になっている", entry && !entry.draft, JSON.stringify(entry));
  check("自分の名前とともに載る", entry?.who.includes("はなこ"), JSON.stringify(entry));
}

// ── Ctrl + Enter でも送れる（Windows） ──
await goto(W);
await put(".compose-body", "Ctrl でも送れる一枚");
check("Ctrl+Enter も送りにいく", await key(".compose-body", { key: "Enter", ctrlKey: true }));
await confirm();
await wait(3200);
check("Ctrl でも送れている", (await path()) === "/sannin" && (await text()).includes("Ctrl でも送れる一枚"), await path());

// ── ただの Enter は改行のまま ──
await goto(W);
await put(".compose-body", "改行したいだけ");
check("Enter だけでは送らない（改行のまま）", !(await key(".compose-body", { key: "Enter" })));
await wait(1500);
check("頁は動かない", (await path()) === "/sannin/write", await path());

// ── 変換中の Enter は、⌘ が添えられていても送らない ──
check("変換中の ⌘+Enter は何もしない", !(await key(".compose-body", { key: "Enter", metaKey: true, isComposing: true })));
await wait(1500);
check("変換中は頁が動かない", (await path()) === "/sannin/write", await path());
check("書きかけはそのまま", (await ev(`document.querySelector(".compose-body").value`)) === "改行したいだけ");

// ── 題の欄からでも送れる。題の欄で Enter だけなら、改行もしないし送りもしない ──
await goto(W);
await put(".compose-title", "近道の題");
await put(".compose-body", "題の欄から送る一枚");
check("題の欄の Enter は改行にならない", await key(".compose-title", { key: "Enter" }));
await wait(1200);
check("題の欄の Enter では送らない", (await path()) === "/sannin/write", await path());
check("題の欄からの ⌘+Enter は送りにいく", await key(".compose-title", { key: "Enter", metaKey: true }));
await confirm();
await wait(3200);
check("題と本文がそろって載る", (await path()) === "/sannin" && (await text()).includes("近道の題"), (await text()).slice(0, 120));

// ── 何も書いていなければ送らない（送っても受け側が断る） ──
await goto(W);
await key(".compose-body", { key: "Enter", metaKey: true });
await wait(2500);
check("空のままの ⌘+Enter は断られる", (await path()) === "/sannin/write" && (await text()).includes("まだ何も書かれていません"),
  (await text()).slice(0, 120));

// ── 書き直しの頁でも同じ手癖が効く ──
{
  await goto(`${B}/sannin`);
  const href = await ev(`[...document.querySelectorAll(".entry")].find(x => x.textContent.includes("近道で書いた一枚"))?.getAttribute("href")`);
  await goto(B + href + "/edit");
  await put(".compose-body", "近道で書き直した一枚");
  check("書き直しでも ⌘+Enter が効く", await key(".compose-body", { key: "Enter", metaKey: true }));
  await confirm();
  await wait(3200);
  check("保存されて一篇の頁に戻る", (await path()) === href && (await text()).includes("近道で書き直した一枚"), await path());
}

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
process.exit(bad.length ? 1 : 0);
