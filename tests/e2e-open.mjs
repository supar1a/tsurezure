// ひらいた瞬間、いつも左端（いちばん新しいところ）に立つか
const version = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0; const waiters = new Map(); const listeners = new Set();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
  if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } else listeners.forEach((f) => f(m)); };
const send = (method, params = {}, sid) => { const id = ++seq;
  return new Promise((res, rej) => { waiters.set(id, (m) => (m.error ? rej(new Error(method)) : res(m.result)));
    ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); }); };
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId); await send("Runtime.enable", {}, sessionId); await send("Network.enable", {}, sessionId);
const evalJs = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)).result.value;
const goto = async (url) => { const p = new Promise((res) => { const fn = (m) => { if (m.method === "Page.loadEventFired" && m.sessionId === sessionId) { listeners.delete(fn); res(); } }; listeners.add(fn); });
  await send("Page.navigate", { url }, sessionId); await p; };
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

const ok = [], bad = [];
const check = (label, cond, extra = "") => (cond ? ok : bad).push(label + (cond ? "" : " ← " + String(extra).slice(0, 160)));

// 巻物の左端に、白紙（いちばん新しい側）が見えているか
const atLatest = async () => evalJs(`
  (() => {
    const scroller = document.getElementById("scroller");
    const stream = scroller.querySelector("[data-stream]");
    const view = scroller.getBoundingClientRect();
    return { gap: Math.round(stream.getBoundingClientRect().left - view.left), width: Math.round(view.width) };
  })()
`);

for (const [label, w, h] of [["PC", 1440, 900], ["スマホ", 390, 844]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: label === "スマホ" }, sessionId);
  await send("Network.setCookie", { name: "tsurezure", value: process.env.TOK, domain: "localhost", path: "/" }, sessionId);
  await goto("http://localhost:3000/sannin?view=maki");
  await settle(2600);
  const at = await atLatest();
  check(`${label}: ひらくと左端（最新）に立つ`, Math.abs(at.gap) < 3, JSON.stringify(at));
  const first = await evalJs(`document.querySelector("#scroller [data-stream] > :first-child")?.getBoundingClientRect().left ?? 0`);
  check(`${label}: 古いほうは画面の右の外にある`, first > (await atLatest()).width, `first=${Math.round(first)}`);
}

console.log("○ " + ok.join("\n○ "));
if (bad.length) console.log("\n× " + bad.join("\n× "));
console.log(bad.length ? `\n${bad.length} 件しくじりました` : `\n${ok.length} 件すべて通りました`);
ws.close();
