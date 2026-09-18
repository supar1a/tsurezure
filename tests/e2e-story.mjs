// 一篇を縦書きの絵にする。頁をひらくと裏で先に描かれ、寸法がストーリー（1080×1920）で、字が乗っているか。
const [, , tok, slipId] = process.argv;
const bail = setTimeout(() => { console.log("（時間切れ）"); process.exit(2); }, 120000); bail.unref?.();
const version = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const ws = new WebSocket(version.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let seq = 0; const waiters = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } };
const send = (method, params = {}, sid) => new Promise((res, rej) => { const id = ++seq; waiters.set(id, (m) => (m.error ? rej(new Error(method + JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId); await send("Network.enable", {}, sessionId); await send("Runtime.enable", {}, sessionId);
await send("Network.setCookie", { name: "tsurezure", value: tok, domain: "localhost", path: "/" }, sessionId);
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)).result.value;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 200)));

// 描かれた canvas を横取りして、大きさと墨の量を数える
await send("Page.addScriptToEvaluateOnNewDocument", { source: `
  const orig = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function (cb, t, q) {
    try {
      const ctx = this.getContext("2d"); const d = ctx.getImageData(0, 0, this.width, this.height).data;
      let ink = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 100) ink++;
      window.__story = { w: this.width, h: this.height, ink, ratio: ink / (this.width * this.height) };
    } catch (e) { window.__story = { err: String(e) }; }
    return orig.call(this, cb, t, q);
  };` }, sessionId);
await send("Page.navigate", { url: `http://localhost:3000/post/${slipId}` }, sessionId);
await wait(6000);
let got = null;
for (let i = 0; i < 20 && !got; i++) { await wait(2000); got = await ev("window.__story || null"); }
check("頁をひらくと、裏で絵が描かれる", !!got, "描かれなかった");
check("絵はストーリーの寸法（1080×1920）", got && got.w === 1080 && got.h === 1920, JSON.stringify(got));
check("字が乗っている（墨の量が 0.3%〜15%）", got && got.ratio > 0.003 && got.ratio < 0.15, JSON.stringify(got));
check("書いた本人には「画像にして共有」の釦がある", await ev(`[...document.querySelectorAll("button")].some(b => b.textContent.trim() === "画像にして共有")`));

// 他の人には出ない
await send("Network.clearBrowserCookies", {}, sessionId);
await send("Network.setCookie", { name: "tsurezure", value: process.env.TARO, domain: "localhost", path: "/" }, sessionId);
await send("Page.navigate", { url: `http://localhost:3000/post/${slipId}` }, sessionId); await wait(2500);
check("ほかの人には出ない", !(await ev(`[...document.querySelectorAll("button")].some(b => b.textContent.trim() === "画像にして共有")`)));

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
process.exit(bad.length ? 1 : 0);
