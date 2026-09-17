// iOS では挿入ポイントを自前で描く。縦組みらしい横棒で、改行すれば次の行の頭に来る。
// iOS そのものは手元に無いので、iPhone の名乗り（UA）で Chrome を動かして、描きかたと位置を見る。
const [, , token] = process.argv;
const bail = setTimeout(() => { console.log("（時間切れ）"); process.exit(2); }, 120000); bail.unref?.();
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
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
await send("Network.setCookie", { name: "tsurezure", value: token, url: "http://localhost:3000/", path: "/" }, sessionId);
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ev = (e) => send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)
  .then((r) => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0,150)); return r.result.value; });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 160)));

const W = "http://localhost:3000/sannin/write";
const caret = () => ev(`(() => { const c = [...document.querySelectorAll(".caret")].find(c => !c.hidden); if (!c) return null; const r = c.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; })()`);
const box = (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; })()`);
const type = async (text) => { await send("Input.insertText", { text }, sessionId); await wait(250); };

// ── iPhone として ──
await send("Emulation.setUserAgentOverride", { userAgent: IPHONE, platform: "iPhone" }, sessionId);
await send("Page.navigate", { url: W }, sessionId); await wait(3000);
await ev(`document.querySelector(".compose-body").focus()`); await wait(300);
check("iOS では、生の挿入ポイントを透明にする", (await ev(`getComputedStyle(document.querySelector(".compose-body")).caretColor`)) === "rgba(0, 0, 0, 0)",
  await ev(`getComputedStyle(document.querySelector(".compose-body")).caretColor`));
const body = await box(".compose-body");
const c0 = await caret();
check("代わりに自前の挿入ポイントが出る", !!c0, JSON.stringify(c0));
check("横棒（縦組みの挿入ポイント）。長さは一字ぶん", c0 && c0.h <= 3 && Math.abs(c0.w - 16) <= 1, JSON.stringify(c0));
check("入力欄の中、いちばん右の列の頭にある", c0 && c0.x >= body.x && c0.x + c0.w <= body.r + 1 && Math.abs(c0.y - body.y) < 6, `${JSON.stringify(c0)} / 欄 ${JSON.stringify(body)}`);
check("棒の色は墨（青ではない）", (await ev(`getComputedStyle(document.querySelector(".caret")).backgroundColor`)) !== "rgb(0, 122, 255)");

await type("あいう");
const c1 = await caret();
check("三字打つと、同じ列で三字ぶん下がる", c1 && c1.x === c0.x && c1.y - c0.y > 40 && c1.y - c0.y < 80, `${JSON.stringify(c0)} → ${JSON.stringify(c1)}`);

await type("\n");
const c2 = await caret();
check("改行すると、次の列（左）の頭に来る", c2 && c2.x < c1.x - 20 && Math.abs(c2.y - c0.y) < 6, `${JSON.stringify(c1)} → ${JSON.stringify(c2)}`);

await type("かき");
await ev(`(() => { const el = document.querySelector(".compose-body"); el.setSelectionRange(1, 1); })()`); await wait(300);
const c3 = await caret();
check("挿入位置を動かせば、棒も付いてくる（一字目のあと）", c3 && c3.x === c0.x && c3.y - c0.y > 12 && c3.y - c0.y < 30, `${JSON.stringify(c3)}`);

// 変換中は下線に任せる
await ev(`document.querySelector(".compose-body").dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))`); await wait(200);
check("変換中は自前の棒を消す", (await caret()) === null);
await ev(`document.querySelector(".compose-body").dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }))`); await wait(200);
check("確定すればまた出る", (await caret()) !== null);

// 焦点を失えば消える
await ev(`document.querySelector(".compose-body").blur()`); await wait(200);
check("焦点を失えば消える", (await caret()) === null);

// 題の欄にも
await ev(`[...document.querySelectorAll(".compose-foot button")].find(b => b.textContent.trim() === "題名を付ける")?.click()`); await wait(400);
await ev(`document.querySelector(".compose-title").focus()`); await wait(300);
const title = await box(".compose-title");
const ct = await caret();
check("題の欄にも、その欄の中に出る", ct && ct.x >= title.x - 1 && ct.x + ct.w <= title.r + 1 && ct.y >= title.y - 1, `${JSON.stringify(ct)} / 題 ${JSON.stringify(title)}`);

// ── iPhone でなければ、何もしない ──
await send("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", platform: "MacIntel" }, sessionId);
await send("Page.navigate", { url: W }, sessionId); await wait(3000);
await ev(`document.querySelector(".compose-body").focus()`); await wait(300);
check("iOS でなければ、生の挿入ポイントのまま", (await ev(`getComputedStyle(document.querySelector(".compose-body")).caretColor`)) !== "rgba(0, 0, 0, 0)");
check("iOS でなければ、自前の棒は無い", (await ev(`document.querySelectorAll(".caret").length`)) === 0);

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
process.exit(bad.length ? 1 : 0);
