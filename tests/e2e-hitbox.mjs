// 押せるもの（a・button）の当たり判定が、見えている字より大きく広がっていないか。
// 縦組みでは inline が上下なので、字の箱（Range）と要素の箱の丈を比べる。
const tok = process.env.TOK;
// 返事が来ないまま止まらないように。時間切れはしくじりとして返す
const bail = setTimeout(() => { console.log("（時間切れ）"); process.exit(2); }, 150000); bail.unref?.();
const version = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const ws = new WebSocket(version.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let seq = 0; const waiters = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } };
const send = (method, params = {}, sid) => new Promise((res, rej) => { const id = ++seq; waiters.set(id, (m) => (m.error ? rej(new Error(method)) : res(m.result))); ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId); await send("Network.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)).result.value;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pages = [["/", null], ["/", tok], ["/private", tok], ["/private?view=maki", tok], ["/sannin", tok], ["/sannin?view=maki", tok], ["/sannin/members", tok], ["/new", tok], ["/me", tok], ["/write", tok], ["/sannin/write", tok]];
const ok = [], bad = [];
for (const [path, t] of pages) {
  await send("Network.clearBrowserCookies", {}, sessionId);
  if (t) await send("Network.setCookie", { name: "tsurezure", value: t, domain: "localhost", path: "/" }, sessionId);
  await send("Page.navigate", { url: "http://localhost:3000" + path }, sessionId); await wait(2200);
  const out = await ev(`(() => {
    const out = [];
    for (const el of document.querySelectorAll("a, button")) {
      if (!el.offsetParent) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
      const range = document.createRange(); range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter(x => x.width > 0 && x.height > 0);
      const img = el.querySelector("img, svg");
      let t = rects.length ? { top: Math.min(...rects.map(x => x.top)), bottom: Math.max(...rects.map(x => x.bottom)), left: Math.min(...rects.map(x => x.left)), right: Math.max(...rects.map(x => x.right)) } : null;
      if (img) { const ir = img.getBoundingClientRect(); t = t ? { top: Math.min(t.top, ir.top), bottom: Math.max(t.bottom, ir.bottom), left: Math.min(t.left, ir.left), right: Math.max(t.right, ir.right) } : ir; }
      if (!t) continue;
      // 押せるものは、共通の土台（btn・book・tap）のどれかを必ず持つ。持たないものは手応えも青い光の消しも効かない
      const cls = el.classList;
      if (!cls.contains("btn") && !cls.contains("book") && !cls.contains("tap")) out.push({ cls: el.className.toString().slice(0, 40), text: el.textContent.trim().slice(0, 14), why: "土台の印（btn/book/tap）が無い" });
      if (cs.webkitTapHighlightColor && !cs.webkitTapHighlightColor.includes("rgba(0, 0, 0, 0)") && cs.webkitTapHighlightColor !== "transparent") out.push({ cls: el.className.toString().slice(0, 40), text: el.textContent.trim().slice(0, 14), why: "タップの青い光が消えていない: " + cs.webkitTapHighlightColor });
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const extraH = r.height - (t.bottom - t.top), extraW = r.width - (t.right - t.left);
      // 余白（padding）と枠のぶんは当然。それを超えて広がっていたら、空白を押しても効く
      const slack = Math.max(extraH, extraW) - pad - 4;
      if (slack > 12) out.push({ cls: el.className.toString().split(" ").slice(0, 2).join("."), text: el.textContent.trim().slice(0, 14), box: [Math.round(r.width), Math.round(r.height)], text_box: [Math.round(t.right - t.left), Math.round(t.bottom - t.top)], slack: Math.round(slack) });
    }
    return out;
  })()`);
  const label = path + (t ? "" : "（名乗る前）") + "：押せるものが共通の土台に載り、当たりが字より広がっていない";
  (out.length ? bad : ok).push(label + (out.length ? " ← " + JSON.stringify(out).slice(0, 200) : ""));
}
await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
// すぐ exit すると、pipe に出した結果が途中で切れることがある。少し待ってから終える
process.exitCode = bad.length ? 1 : 0; setTimeout(() => process.exit(), 300);
