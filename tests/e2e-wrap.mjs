// 自分たちの文（口上・添え書き・注意・釦・品書き）が、書いた場所（<br>）以外で折れていないか。
//
// 縦組みでは列の長さが「丈」で決まり、字間のぶん一字が em より長い。字数で上限を切ると
// 末尾の一〜二字だけが次の列に落ちて、読めた文が読めなくなる。何度も起きたので、ここで見張る。
//
// 見かた：中身の字の箱（Range の getClientRects）を、縦組みなら left、横組みなら top で束ねれば列の本数。
// それが、書いた <br> の数 + 1 を超えていたら折れている。
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
const check = (label, cond, extra = "") => (cond ? ok : bad).push(label + (cond ? "" : " ← " + String(extra).slice(0, 200)));

// 見張る要素。人が入れた名前や題（長さが決まらないもの）は含めない。
const OURS = [
  ".about-kicker", ".about-title", ".about-text", ".about-link", ".landing-note", ".landing-invite .caption", ".welcome .caption",
  ".panel-title", ".caption", ".masthead-link", ".btn", ".waiting", ".share-dialog-title",
];

const wrapped = async () => evalJs(`
  (() => {
    const out = [];
    for (const sel of ${JSON.stringify(OURS)}) {
      for (const el of document.querySelectorAll(sel)) {
        if (!el.offsetParent && getComputedStyle(el).position !== "fixed") continue;
        const cs = getComputedStyle(el);
        const vertical = cs.writingMode.startsWith("vertical");
        // 中身の字の箱を列ごとに数える（余白や枠に惑わされない）
        const range = document.createRange();
        range.selectNodeContents(el);
        const keys = new Set();
        for (const r of range.getClientRects()) {
          if (r.width < 1 || r.height < 1) continue;
          keys.add(Math.round(vertical ? r.left : r.top));
        }
        const lines = keys.size;
        if (lines === 0) continue;
        const written = el.querySelectorAll("br").length + 1;
        if (lines > written) out.push(sel + "「" + el.textContent.trim().slice(0, 24) + "」 " + lines + "列（書いたのは " + written + "）");
      }
    }
    return out;
  })()
`);

const pages = [
  ["名乗る前のトップ", "/", null],
  ["トップ", "/", process.env.TOK],
  ["ひとりのスペース", "/private", process.env.TOK],
  ["スペースの目次", "/sannin", process.env.TOK],
  ["スペースを作る", "/new", process.env.TOK],
  ["設定", "/me", process.env.TOK],
  ["このスペース", "/sannin/members", process.env.TOK],
];

for (const [label, w, h] of [["PC", 1440, 900], ["スマホ", 390, 844]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: label === "スマホ" }, sessionId);
  for (const [name, path, tok] of pages) {
    await send("Network.clearBrowserCookies", {}, sessionId);
    if (tok) await send("Network.setCookie", { name: "tsurezure", value: tok, domain: "localhost", path: "/" }, sessionId);
    await goto("http://localhost:3000" + path);
    await settle(1800);
    const found = await wrapped();
    check(`${label} ${name}: 自分たちの文が書いた場所以外で折れていない`, found.length === 0, found.join(" / "));
  }
}

console.log("○ " + ok.join("\n○ "));
if (bad.length) console.log("\n× " + bad.join("\n× "));
console.log(bad.length ? `\n${bad.length} 件しくじりました` : `\n${ok.length} 件すべて通りました`);
ws.close();
