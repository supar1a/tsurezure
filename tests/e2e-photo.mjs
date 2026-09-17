// 写真は貼り付けで一枚だけ。貼ると本文が二つに割れ、そこに写真そのものが挟まる。
// 見せてよい人にだけ出す。目次では一枚も取りにいかない。
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
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 820, deviceScaleFactor: 1, mobile: false }, sessionId);
const ev = (e) => send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)
  .then((r) => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0,150)); return r.result.value; });
const goto = async (u) => { await send("Page.navigate", { url: u }, sessionId); await new Promise((r) => setTimeout(r, 2400)); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const path = () => ev(`location.pathname`);
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 160)));

const B = "http://localhost:3000";
const MAKI = `${B}/sannin?view=maki`;
const enterAs = async (name) => {
  await send("Network.clearBrowserCookies", {}, sessionId);
  await goto(B + "/");
  await ev(`[...document.querySelectorAll(".debug-btn")].find(b => b.textContent.includes(${JSON.stringify(name)})).click()`);
  await wait(2600);
};
const put = (sel, v) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) throw new Error("見つからない: " + ${JSON.stringify(sel)} + " @ " + location.pathname);
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, ${JSON.stringify(v)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return el.value;
})()`);
// 画像を貼ったことにする。返るのは「こちらで受け取ったか」（既定の動きを止めたか）
const pasteImage = (sel, w, h, caret) => ev(`(async () => {
  const el = document.querySelector(${JSON.stringify(sel)});
  el.focus(); el.setSelectionRange(${caret}, ${caret});
  const c = document.createElement("canvas"); c.width = ${w}; c.height = ${h};
  const g = c.getContext("2d"); g.fillStyle = "#b03a2e"; g.fillRect(0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const dt = new DataTransfer(); dt.items.add(new File([blob], "p.png", { type: "image/png" }));
  const e = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e.defaultPrevented;
})()`);
const pasteText = (sel) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  const dt = new DataTransfer(); dt.setData("text/plain", "ただの文字");
  const e = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e.defaultPrevented;
})()`);
const composer = () => ev(`({
  photos: document.querySelectorAll(".compose-photo img").length,
  before: document.querySelector('textarea[name="bodyBefore"]')?.value ?? null,
  after: document.querySelector('textarea[name="bodyAfter"]')?.value ?? null,
  width: document.querySelector('input[name="photoWidth"]').value,
  height: document.querySelector('input[name="photoHeight"]').value,
  remove: document.querySelector('input[name="photoRemove"]').value,
  files: [...(document.querySelector('input[name="photo"]').files ?? [])].map(f => f.type),
  focus: document.activeElement?.name ?? document.activeElement?.tagName,
  caret: document.activeElement?.selectionStart ?? null,
  src: document.querySelector(".compose-photo img")?.getAttribute("src") ?? null,
})`);
// 一枚のなかの並び：本文・写真・本文
const layout = (needle) => ev(`(() => {
  const s = [...document.querySelectorAll(".slip, .sheet")].find(x => x.textContent.includes(${JSON.stringify(needle)}));
  if (!s) return null;
  const kinds = [...s.querySelectorAll(".slip-body, .sheet-body, .slip-photo, .sheet-photo")].map(e => e.className.includes("photo") ? "写真" : "本文");
  const img = s.querySelector(".slip-photo img, .sheet-photo img");
  return { kinds, mark: s.textContent.includes("［写真］"), src: img?.getAttribute("src"), w: img?.getAttribute("width"), h: img?.getAttribute("height"), lazy: img?.getAttribute("loading") };
})()`);
// ブラウザの控え（immutable で一年もつ）を通さず、毎回サーバーにきく
const fetchAsPage = (u) => ev(`fetch(${JSON.stringify(u)}, { cache: "no-store" }).then(r => ({ status: r.status, type: r.headers.get("content-type"), cache: r.headers.get("cache-control"), vary: r.headers.get("vary") }))`);

// ── 種の一枚：写真が本文のあいだに挟まっている ──
await enterAs("はなこ");
await goto(MAKI);
const seed = await layout("古本屋、今日は開いてた");
check("巻物で、写真が本文のあいだに挟まる（本文・写真・本文）", JSON.stringify(seed?.kinds) === JSON.stringify(["本文", "写真", "本文"]), JSON.stringify(seed));
check("印の文字「［写真］」は見せない", seed && !seed.mark, JSON.stringify(seed));
check("大きさを先に書いてある（読み込みで組みが動かない）", seed?.w === "640" && seed?.h === "420", `${seed?.w}×${seed?.h}`);
check("見えるまで取りにいかない", seed?.lazy === "lazy", seed?.lazy);
const photoUrl = seed?.src ?? "/photo/none";

// ── 目次では一枚も取りにいかない ──
await goto(`${B}/sannin`);
check("目次には写真を置かない", (await ev(`document.querySelectorAll('img[src^="/photo/"]').length`)) === 0);
{
  const marks = await ev(`[...document.querySelectorAll(".entry")].map(e => [e.querySelector(".entry-title").textContent.slice(0, 6), !!e.querySelector(".entry-mark")])`);
  check("写真のある一篇にだけ「写」の印", marks.some(([t, m]) => t.startsWith("古本屋、今日") && m) && marks.filter(([, m]) => m).length === 1, JSON.stringify(marks));
}

// ── 写真は、本文と同じだけ秘密 ──
{
  const r = await fetchAsPage(photoUrl);
  check("メンバーには写真が出る", r.status === 200 && r.type === "image/png", JSON.stringify(r));
  check("控えは自分のブラウザにだけ", (r.cache ?? "").includes("private"), r.cache);
  check("誰として見ているかで変わると断ってある（Vary: Cookie）", (r.vary ?? "").toLowerCase().includes("cookie"), r.vary);
}
{
  const r = await fetch(B + photoUrl);
  check("名乗らない相手には無いことにする（404）", r.status === 404, r.status);
}
{
  // 別のグループの人にも見せない
  await send("Network.clearBrowserCookies", {}, sessionId);
  await goto(B + "/");
  await ev(`(() => { const el = document.querySelector('form input[name="name"]'); el.value = "よそもの"; el.form.querySelector('button[type=submit]').click(); })()`);
  await wait(3000);
  await goto(B + "/new");
  await ev(`(() => { const el = document.querySelector('form input[name="name"]'); el.value = "よそのところ"; el.form.querySelector('button[type=submit]').click(); })()`);
  await wait(3000);
  const r = await fetchAsPage(photoUrl);
  check("よそのグループの人にも無いことにする（404）", r.status === 404, JSON.stringify(r));
}

// ── 貼る ──
await enterAs("はなこ");
await goto(`${B}/sannin/write`);
await put('textarea[name="bodyBefore"]', "前半の文\n後半の文");
check("画像の貼り付けは、こちらで受け取る", await pasteImage('textarea[name="bodyBefore"]', 1200, 600, 5));
await wait(1800);
{
  const c = await composer();
  check("写真そのものが挟まる", c.photos === 1 && (c.src ?? "").startsWith("blob:"), JSON.stringify(c));
  check("書いていたところで本文が二つに割れる", c.before?.trim() === "前半の文" && c.after === "後半の文", JSON.stringify(c));
  check("続きは写真のあとから書ける（焦点が後ろの欄の頭）", c.focus === "bodyAfter" && c.caret === 0, `${c.focus} @ ${c.caret}`);
  check("大きさも一緒に送る", c.width === "1200" && c.height === "600", `${c.width}×${c.height}`);
  check("送る形は JPEG に縮めたもの", JSON.stringify(c.files) === JSON.stringify(["image/jpeg"]), JSON.stringify(c.files));
}

// 二枚目を貼ると入れ替わる（割れなおしはしない）。大きすぎるものは 1600 まで縮める。
check("後ろの欄に貼っても受け取る", await pasteImage('textarea[name="bodyAfter"]', 4000, 2000, 0));
await wait(2200);
{
  const c = await composer();
  check("写真は一枚きり（入れ替わる）", c.photos === 1, c.photos);
  check("長い辺を 1600 まで縮める", c.width === "1600" && c.height === "800", `${c.width}×${c.height}`);
  check("本文はもう割れなおさない", c.before?.trim() === "前半の文" && c.after === "後半の文", JSON.stringify(c));
}

// 文字の貼り付けは邪魔しない
check("文字の貼り付けは素通し", !(await pasteText('textarea[name="bodyAfter"]')));
check("文字を貼っても写真は動かない", (await composer()).photos === 1);

// 外すと、またひとつにつながる
await ev(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "外す").click()`);
await wait(600);
{
  const c = await composer();
  check("外すと写真が消える", c.photos === 0 && c.files.length === 0, JSON.stringify(c));
  check("割れていた本文がまたひとつにつながる", c.before === "前半の文\n\n後半の文" && c.after === null, JSON.stringify(c));
  check("焦点は本文に戻る", c.focus === "bodyBefore", c.focus);
}

// 貼って、送る
await pasteImage('textarea[name="bodyBefore"]', 800, 400, 5);
await wait(1800);
await ev(`document.querySelector(".compose-foot > button").click()`); await wait(400);
await ev(`document.querySelector("dialog[open] button[type=submit]")?.click()`);
await wait(3500);
check("送るとスペースへ戻る", (await path()) === "/sannin", await path());
check("目次に「写」の印つきで載る",
  await ev(`!![...document.querySelectorAll(".entry")].find(e => e.textContent.includes("前半の文") && e.querySelector(".entry-mark"))`));
const href = await ev(`[...document.querySelectorAll(".entry")].find(e => e.textContent.includes("前半の文"))?.getAttribute("href") ?? ""`);

await goto(MAKI);
const mine = await layout("前半の文");
check("巻物で、貼ったところに写真が挟まっている", JSON.stringify(mine?.kinds) === JSON.stringify(["本文", "写真", "本文"]), JSON.stringify(mine));
check("大きさは縮めたあとの値", mine?.w === "800" && mine?.h === "400", `${mine?.w}×${mine?.h}`);
{
  const r = await fetchAsPage(mine?.src ?? "/photo/none");
  check("送った写真は JPEG で取り出せる", r.status === 200 && r.type === "image/jpeg", JSON.stringify(r));
}

// 書き直しの頁でも、割れた形のまま戻る
await goto(B + href + "/edit");
{
  const c = await composer();
  check("書き直しでも、前・写真・後ろ の形で戻る", c.before === "前半の文" && c.after === "後半の文" && c.photos === 1, JSON.stringify(c));
  check("置いてある写真をそのまま見せる", (c.src ?? "").startsWith("/photo/"), c.src);
  check("外していないので、消す印は立っていない", c.remove === "", c.remove);
}
// 外して保存すると、写真ごと消えて本文がつながる
await ev(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "外す").click()`);
await wait(500);
check("外すと、消す印が立つ", (await composer()).remove === "1");
await ev(`document.querySelector(".compose-foot > button").click()`); await wait(400);
await ev(`document.querySelector("dialog[open] button[type=submit]")?.click()`);
await wait(3200);
check("保存すると一篇の頁に戻る", (await path()) === href, await path());
{
  const l = await layout("前半の文");
  check("写真が消え、本文だけになる", JSON.stringify(l?.kinds) === JSON.stringify(["本文"]), JSON.stringify(l));
  const r = await fetchAsPage(mine?.src ?? "/photo/none");
  check("消した写真は、もうサーバーから取り出せない", r.status === 404, r.status);
}
await goto(B + href + "/edit");
check("本文はひとつにつながって戻る", (await composer()).before === "前半の文\n\n後半の文", JSON.stringify(await composer()));
await goto(`${B}/sannin`);
check("目次の「写」の印も消える",
  await ev(`!![...document.querySelectorAll(".entry")].find(e => e.textContent.includes("前半の文") && !e.querySelector(".entry-mark"))`));

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
process.exit(bad.length ? 1 : 0);
