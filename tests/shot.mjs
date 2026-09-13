import { writeFileSync } from "node:fs";
const [, , cookie, ...pairs] = process.argv;
const targets = pairs.map((p) => { const i = p.indexOf("="); return [p.slice(0, i), p.slice(i + 1)]; });
const bail = setTimeout(() => { console.log("（時間切れ）"); process.exit(2); }, 90000); bail.unref?.();
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
await send("Page.enable", {}, sessionId); await send("Network.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", {
  width: Number(process.env.VW || 1440), height: Number(process.env.VH || 900),
  deviceScaleFactor: 2, mobile: process.env.VW === "390" }, sessionId);
if (cookie === "none") await send("Network.clearBrowserCookies", {}, sessionId);
else await send("Network.setCookie", { name: "tsurezure", value: cookie, domain: "localhost", path: "/" }, sessionId);
for (const [name, url] of targets) {
  await send("Page.navigate", { url }, sessionId);
  await new Promise((r) => setTimeout(r, 2600));
  await send("Runtime.evaluate", { expression: "document.fonts.ready.then(()=>1)", awaitPromise: true }, sessionId);
  await new Promise((r) => setTimeout(r, 500));
  const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
  writeFileSync(`${process.env.SCRATCH}/${name}.png`, Buffer.from(shot.data, "base64"));
  console.log("撮影:", name);
}
await send("Target.closeTarget", { targetId }); ws.close(); clearTimeout(bail); process.exit(0);
