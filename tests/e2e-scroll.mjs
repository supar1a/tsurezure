// ひらいた場所と、そのあと誰が巻きを握るか。
const [, , token] = process.argv;
const bail = setTimeout(() => { console.log("（時間切れ）"); process.exit(2); }, 180000); bail.unref?.();
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
await send("Network.setCookie", { name: "tsurezure", value: token, domain: "localhost", path: "/" }, sessionId);
const ev = (e) => send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)
  .then((r) => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0,150)); return r.result.value; });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 160)));

// 中身の左端が、画面の左端からどれだけずれているか。0 なら端まで行き着いている。
// （端の余白は中身が自前で持っているので、そのぶんは中身の内側にある）
const gap = () => ev(`(() => { const s = document.getElementById("scroller");
  if (!s) return "9999";
  const stream = s.querySelector("[data-stream]");
  if (!stream) return "9999";
  return String(Math.round(stream.getBoundingClientRect().left - s.getBoundingClientRect().left)); })()`)
  .then((v) => (v === undefined ? NaN : Number(v)));
const at = () => ev(`(() => { const s = document.getElementById("scroller");
  return s ? String(Math.round(s.scrollLeft)) : "なし"; })()`).then((v) => (v === "なし" ? null : Number(v)));
const room = () => ev(`(() => { const s = document.getElementById("scroller");
  return s ? String(Math.round(s.scrollWidth - s.clientWidth)) : "なし"; })()`);

const open = async (url, w, h) => {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 }, sessionId);
  await send("Page.navigate", { url }, sessionId);
  // 組み上がるのを待つ。開発サーバは初回に時間がかかることがある。
  for (let i = 0; i < 40; i++) {
    await wait(250);
    if (await ev(`!!document.getElementById("scroller")`)) break;
  }
  await wait(2400);
};

for (const [label, url, w, h] of [
  ["目次・スマホ", "http://localhost:3000/sannin", 390, 780],
  ["巻物・スマホ", "http://localhost:3000/sannin?view=maki", 390, 780],
  ["巻物・PC", "http://localhost:3000/sannin?view=maki", 1440, 900],
]) {
  await open(url, w, h);
  check(`${label}：ひらくと左端に立つ`, Math.abs(await gap()) < 3, `左端から ${await gap()}px / 動ける幅 ${await room()}`);
}

// ── 何かに右端へ戻されても、置きなおす ──
await open("http://localhost:3000/sannin", 390, 780);
check("戻される前は左端", Math.abs(await gap()) < 3, `${await gap()}`);
await ev(`(() => { const s = document.getElementById("scroller"); if (s) s.scrollLeft = s.scrollWidth; })()`); // 右端（はじまり）へ引き戻す
await wait(900);
check("誰かに右端へ戻されても、置きなおす", Math.abs(await gap()) < 3, `左端から ${await gap()}px（戻ってこない）`);

// ── 人が自分で送ったら、二度と引き戻さない ──
await open("http://localhost:3000/sannin", 390, 780);
{
  // 指で触れて、滑らせて送る。
  // 触れて離すだけだと一覧の行（＝頁への戸口）を押したことになり、画面が移ってしまう。
  // 合成の指では巻きは実際には流れないので、指を置いている間に位置を動かして、
  // 「指が触れている最中に送られた」という形を作る。部品が見ているのはそこ。
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 400 }] }, sessionId);
  await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 240, y: 400 }] }, sessionId);
  await ev(`(() => { const s = document.getElementById("scroller"); if (s) s.scrollLeft += 220; })()`);
  await wait(120);
  await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 280, y: 400 }] }, sessionId);
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
  await wait(1500);

  // 送った先がどこであれ、そこに留まっていること。
  // 位置そのものは指の勢いで決まるので、数ではなく「動かされないこと」を見る。
  const left = await at();
  check("人が送ったあと、画面は移っていない", (await ev(`location.pathname`)) === "/sannin", await ev(`location.pathname`));
  check("人が送ったら、左端へは引き戻さない", Math.abs(await gap()) > 3,
    `いま ${left} / 左端からのずれ ${await gap()}`);

  await wait(1500);
  check("しばらく置いても、そのまま", Math.abs((await at()) - left) < 3, `${left} → ${await at()}`);

  // そのあと外から動かされても、こちらからは戻さない
  await ev(`(() => { const s = document.getElementById("scroller"); if (s) s.scrollLeft = s.scrollWidth; })()`);
  await wait(900);
  // 右端そのものに居るかは見ない。柱の出し入れで巻きの幅が変わるので、置いた瞬間の右端と
  // 落ち着いたあとの右端は一致しない。見るのは「左端へ引き戻されていない」こと。
  check("人に渡したあとは、右端に置かれても黙っている（左端へ引き戻さない）", Math.abs(await gap()) > 100,
    `左端から ${await gap()}px`);
}

// ── 書き残したあとも、左端でひらく ──
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 780, deviceScaleFactor: 1, mobile: true }, sessionId);
await send("Page.navigate", { url: "http://localhost:3000/sannin/write" }, sessionId);
await wait(2600);
await ev(`document.querySelector(".compose-body").focus()`);
await send("Input.insertText", { text: "書き残したあと、どこがひらくか。" }, sessionId);
await wait(400);
await ev(`[...document.querySelectorAll("button")].find(b => b.textContent.includes("書き残す")).click()`);
await wait(5500);
// 送ったあとは行き先が入れ替わる。まだ入れ替わりの途中だと測れないので、
// 数を一度だけ取り、取れなければ少し待って取りなおす。
// 送ったあとは行き先が入れ替わる。数のまま受け取ると取りこぼすことがあるので、
// 文字にして渡す。
const landed = Number(await ev(`(() => { const s = document.getElementById("scroller");
  if (!s) return "9999";
  const st = s.querySelector("[data-stream]");
  if (!st) return "9999";
  return String(Math.round(st.getBoundingClientRect().left - s.getBoundingClientRect().left));
})()`));

check("書き残したあとも、左端（いちばん新しいところ）でひらく",
  typeof landed === "number" && Math.abs(landed) < 3,
  `場所 ${await ev(`location.pathname`)} / 左端から ${landed}px`);

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
process.exit(bad.length ? 1 : 0);
