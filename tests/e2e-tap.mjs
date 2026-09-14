// 巻きの中のものが、指で押せるか。
//
// iOS の WebKit は、縦組みの器が原点（右端）以外へ送られていると、中のもの（一篇の帯の釦、
// 巻物の日付）に触れた瞬間に原点へ引き戻して、押せなくする。器を横組みにして原点を左端に
// 置き、送りを正の値だけにすることで避けている。ここでは、その形が崩れていないことと、
// Chrome での指のタップが通ることを見る。WebKit そのものは tests/webkit-tap.mjs で見る。
const [, , token, slipId] = process.argv;
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
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 }, sessionId);
await send("Network.setCookie", { name: "tsurezure", value: token, url: "http://localhost:3000/", path: "/" }, sessionId);
const ev = (e) => send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)
  .then((r) => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0,150)); return r.result.value; });
const goto = async (u) => { await send("Page.navigate", { url: u }, sessionId); await new Promise((r) => setTimeout(r, 3000)); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const path = () => ev(`location.pathname`);
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 160)));

const B = "http://localhost:3000";
const geo = () => ev(`(() => { const s = document.querySelector(".scroll-tate"), t = s.querySelector("[data-stream]"); const r = t.getBoundingClientRect(), v = s.getBoundingClientRect();
  return { sl: Math.round(s.scrollLeft), left: Math.round(r.left - v.left), right: Math.round(r.right - v.right), room: s.scrollWidth - s.clientWidth,
    box: getComputedStyle(s).writingMode, inner: getComputedStyle(t).writingMode }; })()`);
// 指で送る：触れている間に位置を動かす（合成の指を滑らせると、離したあとに引き戻される）
const swipe = async (px) => {
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 400 }] }, sessionId);
  await ev(`document.querySelector(".scroll-tate").scrollLeft += ${px}`);
  await wait(120);
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
  await wait(500);
};
const tap = async (p) => {
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p] }, sessionId);
  await wait(60);
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
  await wait(2500);
};
const center = (finder) => ev(`(() => { const e = ${finder}; if (!e) return null; const r = e.getBoundingClientRect();
  if (r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight) return { off: true };
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);

// ── 巻物：器は横組み、中身は縦組み。原点は左端。 ──
await goto(`${B}/sannin?view=maki`);
{
  const g = await geo();
  check("器は横組み、中身だけ縦組み", g.box === "horizontal-tb" && g.inner === "vertical-rl", `${g.box} / ${g.inner}`);
  check("ひらいた位置が送りの原点（scrollLeft = 0）で、それが左端", g.sl === 0 && Math.abs(g.left) < 3, JSON.stringify(g));
  await swipe(400);
  const h = await geo();
  check("古いほうへ送ると、位置は正の値（負の値を使わない）", h.sl > 0 && h.left < 0, JSON.stringify(h));
  // いちばん近い日付が画面の真ん中に来るよう、もう一度指で送る
  const off = await ev(`(() => { const c = innerWidth / 2; const xs = [...document.querySelectorAll(".slip-when")].map(a => { const r = a.getBoundingClientRect(); return r.x + r.width / 2; });
    return Math.round(xs.reduce((best, x) => Math.abs(x - c) < Math.abs(best - c) ? x : best) - c); })()`);
  await swipe(off);
  const p = await center(`[...document.querySelectorAll(".slip-when")].find(a => { const r = a.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })`);
  check("送った先で、日付が画面の中にある", p && !p.off, JSON.stringify(p));
  if (p && !p.off) { await tap(p); check("送ったあとでも、日付を指で押して一篇へ移れる", (await path()).startsWith("/post/"), await path()); }
}

// ── 一篇：題（右端）からひらく。帯（左端）まで送って、編集を指で押す。 ──
await goto(`${B}/post/${slipId}`);
{
  const g = await geo();
  check("一篇は右端（はじまり）でひらく", Math.abs(g.right) < 3 && g.sl >= 0, JSON.stringify(g));
  check("題が画面の中にある", await ev(`(() => { const t = document.querySelector(".sheet-title, .sheet-byline"); const r = t.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })()`));
  const before = await center(`[...document.querySelectorAll(".sheet-foot a")].find(a => a.textContent.trim() === "編集")`);
  check("帯は、まだ画面の外（左）", before?.off === true, JSON.stringify(before));
  // 指で左端（帯のあるほう）まで送る。原点が左端なので、位置は 0 に向かう。
  await swipe(-10000);
  const h = await geo();
  check("左端まで送れる（位置は 0、負にはならない）", Math.abs(h.left) < 3 && h.sl === 0, JSON.stringify(h));
  const p = await center(`[...document.querySelectorAll(".sheet-foot a")].find(a => a.textContent.trim() === "編集")`);
  check("帯の「編集」が画面の中にある", p && !p.off, JSON.stringify(p));
  if (p && !p.off) {
    check("指の下にあるのは「編集」そのもの", await ev(`(() => { const e = document.elementFromPoint(${p.x}, ${p.y}); const a = [...document.querySelectorAll(".sheet-foot a")].find(a => a.textContent.trim() === "編集"); return e === a || a.contains(e); })()`));
    await tap(p);
    check("「編集」を指で押すと、書き直しの頁へ移る", (await path()) === `/post/${slipId}/edit`, await path());
  }
}

// ── 名簿やあなたの頁も、右端（はじまり）でひらく ──
for (const [label, u] of [["このグループ", `${B}/sannin/members`], ["あなたのページ", `${B}/me`], ["グループの一覧", `${B}/`]]) {
  await goto(u);
  const g = await geo();
  check(`${label}は右端（はじまり）でひらく`, Math.abs(g.right) < 3 && g.sl >= 0, JSON.stringify(g));
}

// ── 名乗る前の戸口も、携帯の幅に収まる（送れる器ではないので、切れたら届かない） ──
await send("Network.clearBrowserCookies", {}, sessionId);
for (const w of [390, 375]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 780, deviceScaleFactor: 1, mobile: true }, sessionId);
  await goto(`${B}/`);
  await ev(`(() => { const st = document.createElement("style"); st.textContent = ".debug{display:none!important}"; document.head.appendChild(st); })()`);
  await wait(200);
  const g = await ev(`(() => { const R = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; };
    const lede = document.querySelector(".leaf-lede"), form = document.querySelector(".gate-form"), gate = document.querySelector(".gate");
    return { docW: document.documentElement.scrollWidth, vw: innerWidth, lede: R(lede), form: R(form), scrollable: gate.scrollWidth > gate.clientWidth, sl: Math.round(gate.scrollLeft) }; })()`);
  check(`${w}px：戸口の頁が横に広がっていない（縮小表示にならない）`, g.docW <= g.vw && g.vw === w, JSON.stringify(g));
  check(`${w}px：断り書きまで画面の中に収まる（または右から送れる）`, (g.lede[0] >= 0 && g.lede[1] <= w) || g.scrollable, JSON.stringify(g));
}

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
process.exit(bad.length ? 1 : 0);
