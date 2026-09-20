// 紙の音。ひらいただけでは鳴らさず、触れてから起こす。頁を繰れば鳴り、打てば筆の音がする。
// 止めればどこでも鳴らず、止めたことはブラウザに残る。
const [, , token] = process.argv;
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
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 820, deviceScaleFactor: 1, mobile: false }, sessionId);
await send("Network.setCookie", { name: "tsurezure", value: token, url: "http://localhost:3000/", path: "/" }, sessionId);

// 音の仕掛けに数取りを仕込む。鳴らす本体はそのままで、起こした回数と鳴らした回数だけ数える。
await send("Page.addScriptToEvaluateOnNewDocument", { source: `
  (() => {
    window.__ctxs = 0; window.__bursts = 0; window.__thuds = 0;
    const Real = window.AudioContext;
    class Counted extends Real {
      constructor(...a) { super(...a); window.__ctxs++; }
      createBufferSource() { window.__bursts++; return super.createBufferSource(); }
      createOscillator() { window.__thuds++; return super.createOscillator(); }
    }
    window.AudioContext = Counted; window.webkitAudioContext = Counted;
  })();
` }, sessionId);

const ev = (e) => send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)
  .then((r) => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0,150)); return r.result.value; });
const goto = async (u) => { await send("Page.navigate", { url: u }, sessionId); await new Promise((r) => setTimeout(r, 2400)); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const path = () => ev(`location.pathname`);
const tally = () => ev(`({ ctxs: window.__ctxs, bursts: window.__bursts, thuds: window.__thuds })`);
// 何かをして、そのあいだに鳴った数を返す（同期で鳴るので、その場で差を取る）
const heard = (action) => ev(`(() => { const b = window.__bursts, t = window.__thuds; ${action}; return { bursts: window.__bursts - b, thuds: window.__thuds - t }; })()`);
const click = (finder) => `[...document.querySelectorAll("a, button")].find(${finder}).click()`;
const key = (sel, init) => `document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...${JSON.stringify(init)} }))`;
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 160)));

const B = "http://localhost:3000";

// 止めた控えはブラウザに残り、前の試験（名乗り）が止めたまま置いていくので、まず白紙に戻す
await goto(B + "/");
await ev(`localStorage.removeItem("tsurezure.muted")`);

// ── ひらいただけでは、音の仕掛けを起こさない ──
await goto(B + "/");
check("ひらいただけでは起こさない（自動再生はしない）", (await tally()).ctxs === 0, JSON.stringify(await tally()));
await ev(`window.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))`);
await wait(200);
check("最初に触れたときに起こす", (await tally()).ctxs === 1, JSON.stringify(await tally()));
check("起こしただけでは鳴らない", (await tally()).bursts === 0, JSON.stringify(await tally()));

// ── 頁を繰ると鳴る。声は行き先で違う ──
{
  const h = await heard(click(`a => a.closest(".about") && a.textContent.trim() === "スペースを作る"`));
  check("戸口を押すと紙の音（撫でる：ひと掴み）", h.bursts === 1 && h.thuds === 0, JSON.stringify(h));
  await wait(1800);
  check("そのまま移っている", (await path()) === "/new", await path());
  const t = await heard(click(`a => a.classList.contains("masthead-title")`));
  check("表題は頁をめくる音（擦れと弾け：ふた掴み）", t.bursts === 2 && t.thuds === 0, JSON.stringify(t));
  await wait(1800);
  check("二度目以降、仕掛けを作りなおさない", (await tally()).ctxs === 1, JSON.stringify(await tally()));
}

// ── 書くと、筆の音 ──
await goto(`${B}/sannin/write`);
{
  const h = await heard(`for (const k of ["a", "i", "u"]) ${key(".compose-body", { key: "K" }).replace('"K"', "k")}`);
  check("打てば筆の音。ただし連打では一度きり（42ms）", h.bursts === 1, JSON.stringify(h));
  await wait(120);
  check("間を置けばまた鳴る", (await heard(key(".compose-body", { key: "e" }))).bursts === 1);
  await wait(120);
  check("Shift だけでは鳴らない", (await heard(key(".compose-body", { key: "Shift" }))).bursts === 0);
  await wait(120);
  check("Backspace は鳴る（紙に触れている）", (await heard(key(".compose-body", { key: "Backspace" }))).bursts === 1);
  await wait(120);
  check("Enter も鳴る", (await heard(key(".compose-body", { key: "Enter" }))).bursts === 1);
  await wait(120);
  check("⌘ を添えた鍵では鳴らない（手癖の操作）", (await heard(key(".compose-body", { key: "s", metaKey: true }))).bursts === 0);
  await wait(120);
  const open = await heard(key(".compose-body", { key: "Enter", metaKey: true }));
  check("⌘+Enter は投稿先の窓を開くだけ（まだ鳴らない）", open.bursts === 0 && open.thuds === 0, JSON.stringify(open));
  await wait(400);
  const back = await heard(click(`b => b.closest("dialog") && b.textContent.trim() === "やめる"`));
  check("窓のやめるは頁をめくる音", back.bursts === 2 && back.thuds === 0, JSON.stringify(back));
  await wait(400);
  await key(".compose-body", { key: "Enter", metaKey: true }); await wait(400);
  const ink = await heard(click(`b => b.closest("dialog") && b.textContent.trim() === "投稿する"`));
  check("投稿するは墨を置く音（低い一打と掠れ）", ink.thuds === 1 && ink.bursts === 1, JSON.stringify(ink));
  await wait(2200);
}

// ── 止める。止めたことは、このブラウザに残る ──
await goto(`${B}/me`);
check("あなたの頁をひらいただけでは起こさない", (await tally()).ctxs === 0);
check("はじめは鳴る側（釦は「止める」）", (await ev(`document.querySelector("[aria-pressed]").textContent.trim()`)) === "止める");
{
  const h = await heard(`document.querySelector("[aria-pressed]").click()`);
  await wait(300);
  check("止めるときは音を立てない", h.bursts === 0 && h.thuds === 0, JSON.stringify(h));
  check("止めただけでは仕掛けも起こさない", (await tally()).ctxs === 0, JSON.stringify(await tally()));
  check("釦が「鳴らす」に変わる", (await ev(`document.querySelector("[aria-pressed]").textContent.trim()`)) === "鳴らす");
  check("止めたことを控える", (await ev(`localStorage.getItem("tsurezure.muted")`)) === "1");
}
{
  const h = await heard(click(`a => a.classList.contains("masthead-title")`));
  check("止めているあいだは、頁を繰っても鳴らない", h.bursts === 0, JSON.stringify(h));
  await wait(1800);
}
await goto(`${B}/sannin/write`);
{
  const h = await heard(key(".compose-body", { key: "a" }));
  check("止めているあいだは、打っても鳴らない", h.bursts === 0, JSON.stringify(h));
}
await goto(`${B}/me`);
check("ひらきなおしても止まったまま", (await ev(`document.querySelector("[aria-pressed]").getAttribute("aria-pressed")`)) === "false");
{
  const html = await (await fetch(`${B}/me`, { headers: { Cookie: `tsurezure=${token}` } })).text();
  check("控えはブラウザにだけあり、サーバーは知らない（まず鳴る側で描く）", html.includes('aria-pressed="true"'));
}
{
  const h = await heard(`document.querySelector("[aria-pressed]").click()`);
  await wait(300);
  check("鳴らしなおすと、合図の小さな音", h.bursts === 1 && h.thuds === 0, JSON.stringify(h));
  check("控えも戻る", (await ev(`localStorage.getItem("tsurezure.muted")`)) === "0");
  check("釦も「止める」に戻る", (await ev(`document.querySelector("[aria-pressed]").textContent.trim()`)) === "止める");
}

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
// すぐ exit すると、pipe に出した結果が途中で切れることがある。少し待ってから終える
process.exitCode = bad.length ? 1 : 0; setTimeout(() => process.exit(), 300);
