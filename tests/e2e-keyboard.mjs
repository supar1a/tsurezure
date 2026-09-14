// 鍵盤（ソフトキーボード）が出たときに、書く場が縮むか。
// 縦組みでは字が下へ流れるので、覆われたままだと打っているところが裏に隠れる。
// あわせて、細かい揺れで版面を組み直していないかも見る。
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
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 780, deviceScaleFactor: 1, mobile: true }, sessionId);
await send("Network.setCookie", { name: "tsurezure", value: token, url: "http://localhost:3000/", path: "/" }, sessionId);

// 鍵盤を出したことにする細工。iOS は覆うだけで版面を変えないので、その形をまねる。
await send("Page.addScriptToEvaluateOnNewDocument", { source: `
  (() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const real = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(vv), "height").get;
    window.__kb = 0;
    window.__rebuilds = 0;
    Object.defineProperty(vv, "height", { configurable: true, get() { return real.call(vv) - window.__kb; } });
    window.__keyboard = (px) => { window.__kb = px; vv.dispatchEvent(new Event("resize")); };
    window.__jiggle = (px) => { window.__kb = px; vv.dispatchEvent(new Event("scroll")); };
  })();
` }, sessionId);

const ev = (e) => send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)
  .then((r) => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0,150)); return r.result.value; });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 160)));

await send("Page.navigate", { url: "http://localhost:3000/sannin/write" }, sessionId);
await wait(2800);

const inset = () => ev(`getComputedStyle(document.documentElement).getPropertyValue("--keyboard").trim()`);
const column = () => ev(`Math.round(document.querySelector(".compose-body").clientHeight)`);
const appHeight = () => ev(`Math.round(document.querySelector(".app").getBoundingClientRect().height)`);

// ── 携帯の書く頁のかたち：柱は無く、釦は左の帯、題は頼まれるまで出ない ──
check("書く頁に柱が無い", !(await ev(`!!document.querySelector(".masthead")`)));
check("入力欄の字は 16px を割らない（iOS が触れた瞬間に拡大するのを防ぐ）",
  parseFloat(await ev(`getComputedStyle(document.querySelector(".compose-body")).fontSize`)) >= 16,
  await ev(`getComputedStyle(document.querySelector(".compose-body")).fontSize`));
{
  const r = await ev(`(() => { const f = document.querySelector(".compose-foot").getBoundingClientRect(), b = document.querySelector(".compose-body").getBoundingClientRect();
    return { footRight: Math.round(f.right), bodyLeft: Math.round(b.left), footTop: Math.round(f.top), bodyTop: Math.round(b.top) }; })()`);
  check("釦の帯は本文の左に立つ（下ではない）", r.footRight <= r.bodyLeft && Math.abs(r.footTop - r.bodyTop) < 4, JSON.stringify(r));
}
check("題の欄は、はじめは出ていない", (await ev(`getComputedStyle(document.querySelector(".compose-title")).display`)) === "none");
check("帯に「題を付ける」がある", await ev(`[...document.querySelectorAll(".compose-foot button")].some(b => b.textContent.trim() === "題を付ける")`));
await ev(`[...document.querySelectorAll(".compose-foot button")].find(b => b.textContent.trim() === "題を付ける").click()`);
await wait(300);
check("押せば題の欄が出て、そこから書ける", (await ev(`getComputedStyle(document.querySelector(".compose-title")).display`)) !== "none"
  && (await ev(`document.activeElement?.classList.contains("compose-title")`)));
check("釦は引っ込む", !(await ev(`[...document.querySelectorAll(".compose-foot button")].some(b => b.textContent.trim() === "題を付ける")`)));

check("鍵盤が無いうちは、差し引かない", (await inset()) === "0px", await inset());
const openCol = await column(), openApp = await appHeight();
check("書く欄に丈がある", openCol > 300, `${openCol}px`);

// 鍵盤が 340px ぶん覆う
await ev(`window.__keyboard(340)`);
await wait(500);
check("鍵盤の高さを取れている", (await inset()) === "340px", await inset());
const shrunkApp = await appHeight(), shrunkCol = await column();
check("場そのものが、覆われた分だけ縮む", Math.abs((openApp - shrunkApp) - 340) < 4,
  `${openApp} → ${shrunkApp}`);
check("書く欄も一緒に縮む（字が鍵盤の裏へ流れない）", shrunkCol < openCol - 300, `${openCol} → ${shrunkCol}`);
{
  // 帯も鍵盤の上に残る。下に置いていたころは、送るたびに鍵盤をしまう必要があった。
  const r = await ev(`(() => { const f = document.querySelector(".compose-foot").getBoundingClientRect(), a = document.querySelector(".app").getBoundingClientRect();
    return { footBottom: Math.round(f.bottom), appBottom: Math.round(a.bottom), submit: Math.round(document.querySelector('button[value="publish"]').getBoundingClientRect().bottom) }; })()`);
  check("鍵盤が出ても、釦の帯は鍵盤の上に見えている", r.footBottom <= r.appBottom + 1 && r.submit <= r.appBottom, JSON.stringify(r));
}

// ── 打っている最中の細かい揺れでは、版面を組み直さない ──
{
  const before = await inset();
  for (const px of [346, 352, 341, 348, 344]) {
    await ev(`window.__keyboard(${px})`);
    await wait(60);
  }
  await wait(300);
  check("数ピクセルの揺れでは、版面を組み直さない", (await inset()) === before,
    `${before} → ${await inset()}`);
  check("そのあいだ、書く欄の丈も変わっていない", (await column()) === shrunkCol,
    `${shrunkCol} → ${await column()}`);
}

// 指を動かしたとき（scroll）には反応しない
{
  const before = await inset();
  await ev(`window.__jiggle(0)`);
  await wait(300);
  check("指を動かしただけでは動かさない", (await inset()) === before, `${before} → ${await inset()}`);
}

// しまえば戻る
await ev(`window.__keyboard(0)`);
await wait(500);
check("しまえば元の丈に戻る", Math.abs((await column()) - openCol) < 4, `${await column()} / もとは ${openCol}`);

// 版面を縮める指示も出しているか（Android Chrome 向け）
const meta = await ev(`document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? ""`);
check("版面を縮める指示も出している", meta.includes("interactive-widget=resizes-content"), meta);

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
process.exit(bad.length ? 1 : 0);
