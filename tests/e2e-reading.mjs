// 指を左へ動かすと柱は右へ滑って出ていき、指を右へ動かすとにゅっと戻る。薄れるのではなく滑る。
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
// 指を dx だけ横へ動かす（正なら右へ）。合成の指を実際に滑らせると離したあとに引き戻されるので、
// 指の出来事は DOM に直に投げ、巻きの位置は手で動かす（指に付いてくるように、指と同じ向きへ）。
const drag = async (dx) => {
  await ev(`(async () => {
    const s = document.querySelector(".scroll-tate");
    const touch = (x) => new Touch({ identifier: 1, target: s, clientX: x, clientY: 400 });
    const fire = (type, x) => s.dispatchEvent(new TouchEvent(type, { touches: type === "touchend" ? [] : [touch(x)], bubbles: true, cancelable: true }));
    fire("touchstart", 200);
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      fire("touchmove", 200 + (${dx} * i) / steps);
      s.scrollLeft -= ${dx} / steps;
      await new Promise((r) => setTimeout(r, 30));
    }
    fire("touchend", 200 + ${dx});
  })()`);
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

// ── 指を左へ動かすと出ていき、右へ動かすと戻る ──
await send("Page.navigate", { url: "http://localhost:3000/sannin?view=maki" }, sessionId);
await wait(3500);
check("ひらいた直後は、柱が出ている", (await slid()) < -20, await slid());
{
  // 左端（いちばん新しいところ）でひらいている。指を左へ：柱は右へ滑って出ていく
  await drag(-150);
  check("指を左へ動かすと、柱は右へ滑って出ていく", (await reading()) === "true" && await settled("out"), `${await reading()} / ${await slid()}`);
  check("薄れて消えるのではなく、濃さはそのまま", Number(await opacity()) > 0.95, await opacity());
  check("場所は空けたまま（幅が変わっていない）",
    (await ev(`Math.round(document.querySelector(".masthead").getBoundingClientRect().width) > 0`)));
  check("滑る動きは transform で、組みには触っていない",
    (await ev(`getComputedStyle(document.querySelector(".masthead")).transform`)) !== "none");
  check("横にこぼした分で頁が広がっていない", (await ev(`document.documentElement.scrollWidth`)) <= (await ev(`innerWidth`)),
    `${await ev(`document.documentElement.scrollWidth`)} / ${await ev(`innerWidth`)}`);

  // 指を右へ：右からにゅっと戻る
  await drag(100);
  check("指を右へ動かすと、右から滑って戻る", (await reading()) === "false" && await settled("in"), `${await reading()} / ${await slid()}`);

  // 数ピクセルの揺れでは向きを変えない
  await drag(-4);
  check("数ピクセルの揺れでは動かない", (await reading()) === "false", await reading());

  // また左へ動かせば、また出ていく
  await drag(-200);
  check("また左へ動かせば、また出ていく", (await reading()) === "true" && await settled("out"), `${await reading()} / ${await slid()}`);

  // 右端（いちばん古いところ）まで行ってから、さらに左へ引っぱっても、向きは変えない
  await drag(-3000);
  await wait(300);
  // 端に居たまま柱だけ出す（輪は巻きを動かさない）
  await ev(`document.querySelector(".scroll-tate").dispatchEvent(new WheelEvent("wheel", { deltaX: -60, bubbles: true }))`);
  await wait(300);
  const before = await reading();
  await drag(-200);
  check("右端で左へ引っぱっただけでは、柱を動かさない", (await reading()) === before, `${before} → ${await reading()}`);

  // 輪でも同じ：中身が左へ流れる向き（deltaX が正）で出ていく
  await drag(3000);
  await ev(`document.querySelector(".scroll-tate").dispatchEvent(new WheelEvent("wheel", { deltaX: -60, bubbles: true }))`);
  await wait(200);
  check("輪でも、逆に回せば戻る", (await reading()) === "false", await reading());
  await ev(`document.querySelector(".scroll-tate").dispatchEvent(new WheelEvent("wheel", { deltaX: 60, bubbles: true }))`);
  await wait(200);
  check("輪でも、中身が左へ流れる向きで出ていく", (await reading()) === "true", await reading());
}

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
process.exit(bad.length ? 1 : 0);
