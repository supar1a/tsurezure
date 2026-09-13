// 読み進めるあいだ、柱は引っ込む。区切りの線と、空きの間も見る。
const [, , token] = process.argv;
const bail = setTimeout(() => { console.log("（時間切れ）"); process.exit(2); }, 150000); bail.unref?.();
const v = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let seq = 0; const W = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && W.has(m.id)) { W.get(m.id)(m); W.delete(m.id); } };
const send = (method, params = {}, sid) => new Promise((res, rej) => { const id = ++seq;
  W.set(id, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)));
  ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId); await send("Runtime.enable", {}, sessionId); await send("Network.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 780, deviceScaleFactor: 1, mobile: true }, sessionId);
await send("Network.setCookie", { name: "tsurezure", value: token, url: "http://localhost:3000/", path: "/" }, sessionId);
const ev = (e) => send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)
  .then((r) => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0,150)); return r.result.value; });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 160)));
const opacity = () => ev(`getComputedStyle(document.querySelector(".masthead")).opacity`);
const reading = () => ev(`document.querySelector(".app").dataset.reading ?? "まだ"`);
// 濃さは時間をかけて変わるので、落ち着くまで待つ
const settled = async (want) => {
  for (let i = 0; i < 12; i++) {
    const o = Number(await opacity());
    if (want === "out" ? o < 0.05 : o > 0.95) return true;
    await wait(250);
  }
  return false;
};

// ── 携帯で、グループの囲いに手が届く ──
await send("Page.navigate", { url: "http://localhost:3000/" }, sessionId);
await wait(3000);
{
  const reach = await ev(`(() => {
    const s = document.querySelector(".scroll-tate");
    const b = document.querySelector(".book");
    if (!b) return "囲いが無い";
    const v = s.getBoundingClientRect(), r = b.getBoundingClientRect();
    const seen = Math.min(r.right, v.right) - Math.max(r.left, v.left);
    return String(Math.round(seen));
  })()`);
  check("携帯でも、グループの囲いが画面に出ている", Number(reach) > 60, `見えている幅 ${reach}px`);
  // 実際に指で押して入れる
  const box = JSON.parse(await ev(`(() => { const r = document.querySelector(".book").getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + 60) }); })()`));
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [box] }, sessionId);
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
  await wait(3000);
  check("指で押すと、そのグループへ入れる", (await ev(`location.pathname`)) === "/sannin", await ev(`location.pathname`));
}

// ── 読み進めると、柱が引っ込む ──
await send("Page.navigate", { url: "http://localhost:3000/sannin?view=maki" }, sessionId);
await wait(3500);
check("ひらいた直後は、柱が出ている", Number(await opacity()) > 0.9, await opacity());
{
  // 指で触れてから送る。
  // 合成の指を滑らせると、離したあとにブラウザ側が指の動きぶんへ引き戻すので、
  // 触れている間に位置を動かす形にしてある。
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 400 }] }, sessionId);
  await ev(`(() => { const s = document.querySelector(".scroll-tate"); s.scrollLeft += 400; })()`);
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
  await wait(400);
  check("読み進めたことが伝わっている", (await reading()) === "true", await reading());
  check("読み進めると、柱が引っ込む", await settled("out"), `濃さ ${await opacity()}`);
  check("場所は空けたまま（幅が変わっていない）",
    (await ev(`Math.round(document.querySelector(".masthead").getBoundingClientRect().width) > 0`)));

  // 戻せば、また出る
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 400 }] }, sessionId);
  await ev(`(() => { const s = document.querySelector(".scroll-tate"); s.scrollLeft -= 400; })()`);
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
  await wait(400);
  check("戻れば、また出る", await settled("in"), `濃さ ${await opacity()} / ${await reading()}`);
}

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
process.exit(bad.length ? 1 : 0);
