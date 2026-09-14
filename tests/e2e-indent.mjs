// 改行のたびに一字下げる。
const [, , token] = process.argv;
const bail = setTimeout(() => { console.log("（時間切れ）"); process.exit(2); }, 120000); bail.unref?.();
const v = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let seq = 0; const w = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && w.has(m.id)) { w.get(m.id)(m); w.delete(m.id); } };
const send = (method, params = {}, sid) => new Promise((res, rej) => { const id = ++seq;
  w.set(id, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)));
  ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId); await send("Runtime.enable", {}, sessionId); await send("Network.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false }, sessionId);
await send("Network.setCookie", { name: "tsurezure", value: token, url: "http://localhost:3000/", path: "/" }, sessionId);
const ev = (e) => send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)
  .then((r) => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0,150)); return r.result.value; });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 200)));

// ── 改行を一つだけ入れて書く ──
await send("Page.navigate", { url: "http://localhost:3000/sannin/write" }, sessionId);
await wait(3000);
await ev(`document.querySelector(".compose-body").focus()`);
await send("Input.insertText", { text: "はじめの行。\n次の行。\n三つめの行。\n\n空きのあとの行。 https://example.com/a?b=1 。おわり。\n---\n線のあとの行。" }, sessionId);
await wait(400);
await ev(`[...document.querySelectorAll("button")].find(b => b.textContent.includes("書き残す")).click()`);
await wait(4500);

await send("Page.navigate", { url: "http://localhost:3000/sannin?view=maki" }, sessionId);
await wait(3000);

const lines = await ev(`(() => {
  const box = [...document.querySelectorAll(".slip-body")].find((b) => b.textContent.includes("はじめの行"));
  if (!box) return "見つからない";
  const ps = [...box.querySelectorAll("p")];
  return JSON.stringify({
    数: ps.length,
    字: ps.map((p) => p.textContent),
    下げ: ps.map((p) => getComputedStyle(p).textIndent),
  });
})()`);
check("改行が見つかる", lines !== "見つからない", lines);
const got = lines === "見つからない" ? { 数: 0, 字: [], 下げ: [] } : JSON.parse(lines);

check("改行のたびに、行が分かれる", got.数 === 5, JSON.stringify(got.字));
check("それぞれの行が別々に置かれている",
  got.字[0] === "はじめの行。" && got.字[1] === "次の行。" && got.字[2] === "三つめの行。",
  JSON.stringify(got.字));
check("どの行にも一字下げが付く",
  got.下げ.length === 5 && got.下げ.every((v) => v !== "0px" && parseFloat(v) > 8),
  JSON.stringify(got.下げ));

// ── 「---」は区切りの線になる ──
{
  const rule = await ev(`(() => {
    const box = [...document.querySelectorAll(".slip-body")].find((b) => b.textContent.includes("はじめの行"));
    const hr = box.querySelector("hr.line-rule");
    if (!hr) return "線が無い";
    const r = hr.getBoundingClientRect();
    return JSON.stringify({ 縦: Math.round(r.height), 横: Math.round(r.width), 字: box.textContent.includes("---") });
  })()`);
  check("「---」が線になる", rule !== "線が無い", rule);
  const R = rule === "線が無い" ? {} : JSON.parse(rule);
  check("線は縦に立つ（縦組みの区切り）", R.縦 > 60 && R.横 <= 2, JSON.stringify(R));
  check("「---」の字そのものは残らない", R.字 === false, String(R.字));
}

// ── 空行を続けたところ ──
{
  const apart = await ev(`(() => {
    const box = [...document.querySelectorAll(".slip-body")].find((b) => b.textContent.includes("はじめの行"));
    const ps = [...box.querySelectorAll("p")];
    return JSON.stringify({
      印: ps.map((p) => p.classList.contains("line-apart")),
      間: ps.map((p) => getComputedStyle(p).paddingBlockStart),
    });
  })()`);
  const a = JSON.parse(apart);
  check("空行のあとの行だけに、間の印が付く",
    JSON.stringify(a.印) === JSON.stringify([false, false, false, true, false]), apart);
  // 一行ぶん＝列と列の間隔（line-height 2.8）。書く欄で空行が空くのと同じだけ。
  const fs = parseFloat(await ev(`getComputedStyle([...document.querySelectorAll(".slip-body")].find((b) => b.textContent.includes("はじめの行"))).fontSize`));
  check("その間は、一行ぶん（書く欄で空行が空くのと同じだけ）",
    Math.abs(parseFloat(a.間[3]) - fs * 2.8) < 2 && parseFloat(a.間[0]) === 0,
    `${JSON.stringify(a.間)} / 字 ${fs}px`);
  check("空行そのものは、行として残らない", a.印.length === 5, String(a.印.length));
}

// ── 書かれた URL が戸口になる ──
{
  const link = await ev(`(() => {
    const box = [...document.querySelectorAll(".slip-body")].find((b) => b.textContent.includes("空きのあとの行"));
    const a = box.querySelector("a.link");
    if (!a) return "戸口が無い";
    return JSON.stringify({ 先: a.getAttribute("href"), 字: a.textContent,
      色: getComputedStyle(a).color, 別窓: a.getAttribute("target"), 縁: a.getAttribute("rel") });
  })()`);
  check("URL が戸口になる", link !== "戸口が無い", link);
  const L = link === "戸口が無い" ? {} : JSON.parse(link);
  check("行き先は書かれたとおり", L.先 === "https://example.com/a?b=1", L.先);
  check("末尾の句点は行き先に含めない", !String(L.先).endsWith("。"), L.先);
  check("藍色で出る", L.色 === "rgb(45, 85, 115)", L.色);
  check("別の窓でひらく", L.別窓 === "_blank" && String(L.縁).includes("noreferrer"), `${L.別窓} / ${L.縁}`);
  check("ただの文は戸口にしない", await ev(`(() => {
    const box = [...document.querySelectorAll(".slip-body")].find((b) => b.textContent.includes("はじめの行"));
    return box.querySelectorAll("a.link").length === 1; })()`));
}

// 実際に描かれている位置でも確かめる（指定だけでは、効いているか分からない）
const starts = await ev(`(() => {
  const box = [...document.querySelectorAll(".slip-body")].find((b) => b.textContent.includes("はじめの行"));
  if (!box) return "[]";
  const top = box.getBoundingClientRect().top;
  return JSON.stringify([...box.querySelectorAll("p")].map((p) => {
    const r = document.createRange(); r.selectNodeContents(p);
    return Math.round(r.getBoundingClientRect().top - top);
  }));
})()`);
const s = JSON.parse(starts);
check("どの行も、上から同じだけ下がって始まる",
  s.length === 5 && s.every((v) => v > 8) && Math.max(...s) - Math.min(...s) < 2,
  `上からの下がり ${JSON.stringify(s)}`);

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
process.exit(bad.length ? 1 : 0);
