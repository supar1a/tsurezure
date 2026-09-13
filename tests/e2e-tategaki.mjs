// どの画面にも横組みが残っていないことを見張る。
// 許すのは URL だけ（ラテン文字と記号の並びは、縦に組んでも読めない）。
const [, , cookie] = process.argv;
const version = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const waiters = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); }
};
const send = (method, params = {}, sid) =>
  new Promise((res, rej) => {
    const id = ++seq;
    waiters.set(id, (m) => (m.error ? rej(new Error(method + ": " + JSON.stringify(m.error))) : res(m.result)));
    ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) }));
  });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
await send("Network.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 820, deviceScaleFactor: 1, mobile: false }, sessionId);

const ev = (e) => send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)
  .then((r) => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed"); return r.result.value; });
const goto = async (url) => { await send("Page.navigate", { url }, sessionId); await new Promise((r) => setTimeout(r, 2200)); };

const ok = [], bad = [];
const check = (label, cond, extra = "") => (cond ? ok : bad).push(label + (cond ? "" : " ← " + String(extra).slice(0, 300)));

// 横に組まれたまま見えている字を、ぜんぶ拾う。例外はもう一つも無い。
const SWEEP = `(() => {
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (cs.writingMode !== "horizontal-tb") continue;
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    // 自分が直に抱えている字だけを見る（親の字を子で二重に数えない）
    let own = "";
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") own = el.value || el.placeholder || "";
    own = own.trim();
    if (!own) continue;

    out.push({ tag: el.tagName.toLowerCase(), cls: el.className?.toString?.().slice(0, 40) ?? "", text: own.slice(0, 24) });
  }
  return out;
})()`;

const SCREENS = [
  ["戸口（はじめまして）", "http://127.0.0.1:3000/", "none"],
  ["招待された画面", "http://127.0.0.1:3000/sannin", "none"],
  ["入っているグループ", "http://127.0.0.1:3000/", "me"],
  ["目次", "http://127.0.0.1:3000/sannin", "me"],
  ["巻物", "http://127.0.0.1:3000/sannin?view=maki", "me"],
  ["書く", "http://127.0.0.1:3000/sannin/write", "me"],
  ["メンバー", "http://127.0.0.1:3000/sannin/members", "me"],
  ["グループを作る", "http://127.0.0.1:3000/new", "me"],
  ["名前", "http://127.0.0.1:3000/me", "me"],
  ["一篇の頁", null, "me"],
  ["書きなおす", null, "me"],
];

const slipId = process.argv[3];
SCREENS[9][1] = `http://127.0.0.1:3000/post/${slipId}`;
SCREENS[10][1] = `http://127.0.0.1:3000/post/${slipId}/edit`;

for (const [label, url, who] of SCREENS) {
  if (who === "none") await send("Network.clearBrowserCookies", {}, sessionId);
  else await send("Network.setCookie", { name: "tsurezure", value: cookie, domain: "127.0.0.1", path: "/" }, sessionId);
  await goto(url);

  const stray = (await ev(SWEEP)).filter((s) => !s.cls.includes("debug"));
  check(`${label}：横に組まれた字が残っていない`, stray.length === 0,
    stray.map((s) => `${s.tag}.${s.cls}「${s.text}」`).join(" / "));
}

// 対照。一行だけ横に倒してみて、ちゃんと見つかることを確かめる。
// ここで見つからないなら、上の「残っていない」は何も言っていない。
await goto("http://127.0.0.1:3000/sannin");
await ev(`document.querySelector(".entry-title").style.writingMode = "horizontal-tb"`);
{
  const stray = (await ev(SWEEP)).filter((s) => !s.cls.includes("debug"));
  check("横に倒せば、ちゃんと見つかる（対照）", stray.length === 1 && stray[0].cls.includes("entry-title"),
    JSON.stringify(stray));
}

// 招待 URL も縦に組む。ラテン文字は縦組みのなかで倒れて出る。
await send("Network.setCookie", { name: "tsurezure", value: cookie, domain: "127.0.0.1", path: "/" }, sessionId);
await goto("http://127.0.0.1:3000/sannin/members");
check("招待 URL の札も縦に組んである",
  (await ev(`getComputedStyle(document.querySelector(".invite-url")).writingMode`)) === "vertical-rl",
  await ev(`getComputedStyle(document.querySelector(".invite-url")).writingMode`));
check("その隣の釦も縦に組んである",
  (await ev(`getComputedStyle(document.querySelector(".invite .btn")).writingMode`)) === "vertical-rl");

await send("Target.closeTarget", { targetId });
ws.close();

for (const line of ok) console.log("  ○ " + line);
for (const line of bad) console.log("  × " + line);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
process.exit(bad.length ? 1 : 0);
