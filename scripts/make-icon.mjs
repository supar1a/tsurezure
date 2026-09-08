// サイトの顔を、サイト自身の字で作る。
// Shippori Mincho B1 は SIL OFL 1.1。字を絵に焼いたものは OFL の制限外なので、権利は澄んでいる。
import { writeFileSync } from "node:fs";

const [, , outDir = "app"] = process.argv;
// 使いかた: Chrome を --remote-debugging-port=9222 で立ててから `node scripts/make-icon.mjs app`
const bail = setTimeout(() => { console.log("（時間切れ）"); process.exit(2); }, 90000); bail.unref?.();
const version = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0; const waiters = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } };
const send = (method, params = {}, sid) => new Promise((res, rej) => { const id = ++seq;
  waiters.set(id, (m) => (m.error ? rej(new Error(method + ": " + JSON.stringify(m.error))) : res(m.result)));
  ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); });

const page = (size) => `data:text/html;charset=utf-8,` + encodeURIComponent(`
<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@800&display=block" rel="stylesheet">
<style>
  html,body{margin:0;padding:0}
  body{width:${size}px;height:${size}px;background:#1e1b16;
       display:flex;align-items:center;justify-content:center;overflow:hidden}
  /* 紙の地。本文と同じ漉きかたを、ごく薄く */
  body::before{content:"";position:absolute;inset:0;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' seed='1741' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.3'/%3E%3C/svg%3E");
    mix-blend-mode:screen;opacity:.16}
  span{font-family:"Shippori Mincho B1",serif;font-weight:800;color:#f2eee4;
       font-size:${Math.round(size * 0.88)}px;line-height:1;
       position:relative;display:block;
       transform:translateY(${Math.round(size * 0.02)}px)}
</style></head><body><span>つ</span></body></html>`);

const shot = async (size) => {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: size, height: size, deviceScaleFactor: 1, mobile: false }, sessionId);
  // 透けた地で撮ると PNG が RGBA になる。Next.js の ico 読み取りは RGBA しか受けない。
  // 地そのものは body が塗るので、絵は透けない。
  await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } }, sessionId);
  await send("Page.navigate", { url: page(size) }, sessionId);
  await new Promise((r) => setTimeout(r, 2500));
  await send("Runtime.evaluate", { expression: "document.fonts.ready.then(()=>1)", awaitPromise: true }, sessionId);
  await new Promise((r) => setTimeout(r, 500));
  const { data } = await send("Page.captureScreenshot", { format: "png" }, sessionId);
  await send("Target.closeTarget", { targetId });
  return Buffer.from(data, "base64");
};

const big = await shot(512);
writeFileSync(`${outDir}/icon.png`, big);
writeFileSync(`${outDir}/apple-icon.png`, await shot(180));

/*
 * favicon.ico は、画素を canvas から直に取って昔ながらの形（BMP）で組む。
 * PNG を包んだ ico でもブラウザは読むが、Next.js の読み取りが RGBA しか受けず、
 * Chrome は不透明な絵の alpha を落としてしまうので、そこを通せない。
 */
const pixels = async (size) => {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Page.navigate", { url: page(size) }, sessionId);
  await new Promise((r) => setTimeout(r, 2500));
  const { result } = await send("Runtime.evaluate", {
    expression: `(async () => {
      await document.fonts.ready;
      const c = document.createElement("canvas");
      c.width = ${size}; c.height = ${size};
      const x = c.getContext("2d");
      x.fillStyle = "#1e1b16"; x.fillRect(0, 0, ${size}, ${size});
      x.fillStyle = "#f2eee4";
      x.font = '800 ${Math.round(size * 0.88)}px "Shippori Mincho B1", serif';
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText("つ", ${size / 2}, ${Math.round(size * 0.52)});
      return [...x.getImageData(0, 0, ${size}, ${size}).data];
    })()`,
    awaitPromise: true, returnByValue: true,
  }, sessionId);
  await send("Target.closeTarget", { targetId });
  return Uint8Array.from(result.value);
};

const S = 32;
const rgba = await pixels(S);
const rowBytes = S * 4;
const dib = Buffer.alloc(40 + rowBytes * S + (S * S) / 8);
dib.writeUInt32LE(40, 0);
dib.writeInt32LE(S, 4);
dib.writeInt32LE(S * 2, 8); // 絵と覆いの二枚ぶんの高さを書く決まり
dib.writeUInt16LE(1, 12);
dib.writeUInt16LE(32, 14);
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const from = ((S - 1 - y) * S + x) * 4; // BMP は下から上へ積む
    const to = 40 + (y * S + x) * 4;
    dib[to] = rgba[from + 2];
    dib[to + 1] = rgba[from + 1];
    dib[to + 2] = rgba[from];
    dib[to + 3] = rgba[from + 3];
  }
}
const ico = Buffer.alloc(6 + 16 + dib.length);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico.writeUInt8(S, 6); ico.writeUInt8(S, 7);
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(dib.length, 14); ico.writeUInt32LE(22, 18);
dib.copy(ico, 22);
writeFileSync(`${outDir}/favicon.ico`, ico);

console.log("icon.png", big.length, "/ apple-icon.png / favicon.ico", ico.length);
ws.close(); clearTimeout(bail); process.exit(0);
