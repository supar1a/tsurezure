// 読み進める（指を左へ）と柱は右へ滑って出ていき、戻す（指を右へ）とにゅっと戻る。薄れるのではなく滑る。
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
// 柱の左端が、画面の右端からどれだけ外に出ているか（0 以上なら丸ごと外）
const slid = () => ev(`(() => { const m = document.querySelector(".masthead").getBoundingClientRect(); return Math.round(m.left - innerWidth); })()`);
const reading = () => ev(`document.querySelector(".app").dataset.reading ?? "まだ"`);
// 滑りは時間をかけて動くので、落ち着くまで待つ
const settled = async (want) => {
  for (let i = 0; i < 12; i++) {
    const s = await slid();
    if (want === "out" ? s >= 0 : s < -20) return true;
    await wait(250);
  }
  return false;
};
// 触れたまま送る。合成の指を滑らせると離したあとに引き戻されるので、触れている間に位置を動かす。
const drag = async (px) => {
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 400 }] }, sessionId);
  await ev(`(() => { const s = document.querySelector(".scroll-tate"); s.scrollLeft += ${px}; })()`);
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
  await wait(400);
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

// ── 読み進めると柱が出ていき、戻せば戻る ──
await send("Page.navigate", { url: "http://localhost:3000/sannin?view=maki" }, sessionId);
await wait(3500);
check("ひらいた直後は、柱が出ている", (await slid()) < -20, await slid());
{
  // 左端でひらいている。読み進める＝右にある古いほうへ＝指を左へ。
  // scrollLeft を増やすと画面は右へ寄り、中身は左へ流れる＝指を左へ動かした。
  await drag(400);
  check("読み進める（指を左へ）と、柱は右へ滑って出ていく", (await reading()) === "true" && await settled("out"), `${await reading()} / ${await slid()}`);
  check("薄れて消えるのではなく、濃さはそのまま", Number(await opacity()) > 0.95, await opacity());
  check("場所は空けたまま（幅が変わっていない）",
    (await ev(`Math.round(document.querySelector(".masthead").getBoundingClientRect().width) > 0`)));
  check("滑る動きは transform で、組みには触っていない",
    (await ev(`getComputedStyle(document.querySelector(".masthead")).transform`)) !== "none");
  check("横にこぼした分で頁が広がっていない", (await ev(`document.documentElement.scrollWidth`)) <= (await ev(`innerWidth`)),
    `${await ev(`document.documentElement.scrollWidth`)} / ${await ev(`innerWidth`)}`);

  // 戻す（指を右へ）：右からにゅっと戻る。ひらいた位置まで戻らなくても、向きが変わればすぐ。
  await drag(-150);
  check("戻す（指を右へ）と、右から滑って戻る", (await reading()) === "false" && await settled("in"), `${await reading()} / ${await slid()}`);

  // 数ピクセルの揺れでは向きを変えない
  await drag(4);
  check("数ピクセルの揺れでは動かない", (await reading()) === "false", await reading());

  // また読み進めれば、また出ていく
  await drag(300);
  check("また読み進めれば、また出ていく", (await reading()) === "true" && await settled("out"), `${await reading()} / ${await slid()}`);

  // 右端（いちばん古いところ）まで行って、さらに引っぱっても（跳ね返り）、向きは変えない
  await drag(-3000);
  await wait(300);
  await drag(3000);
  await wait(300);
  const before = await reading();
  await ev(`(() => { const s = document.querySelector(".scroll-tate"); s.scrollLeft += 200; })()`);
  await wait(300);
  check("右端で引っぱっただけでは、柱を動かさない", (await reading()) === before, `${before} → ${await reading()}`);
}

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
process.exit(bad.length ? 1 : 0);
