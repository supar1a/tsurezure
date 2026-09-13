// 目次の見え方
const version = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0; const waiters = new Map(); const listeners = new Set();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
  if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } else listeners.forEach((f) => f(m)); };
const send = (method, params = {}, sid) => { const id = ++seq;
  return new Promise((res, rej) => { waiters.set(id, (m) => (m.error ? rej(new Error(method + " " + JSON.stringify(m.error))) : res(m.result)));
    ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); }); };
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId); await send("Runtime.enable", {}, sessionId); await send("Network.enable", {}, sessionId);
const evalJs = async (e) => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed"); return r.result.value; };
const goto = async (url) => { const p = new Promise((res) => { const fn = (m) => { if (m.method === "Page.loadEventFired" && m.sessionId === sessionId) { listeners.delete(fn); res(); } }; listeners.add(fn); });
  await send("Page.navigate", { url }, sessionId); await p; };
const settle = (ms = 1800) => new Promise((r) => setTimeout(r, ms));
const path = () => evalJs("location.pathname" );
const text = () => evalJs("document.body.innerText");
const enterAs = async (name) => {
  await send("Network.clearBrowserCookies", {}, sessionId);
  await goto("http://localhost:3000/"); await settle(900);
  await evalJs(`[...document.querySelectorAll('.debug-btn')].find(b => b.textContent.includes(${JSON.stringify(name)})).click()`);
  await settle(2500);
};

const ok = [], bad = [];
const check = (label, cond, extra = "") => (cond ? ok : bad).push(label + (cond ? "" : " ← " + String(extra).slice(0, 200)));
const B = "http://localhost:3000/sannin";

await enterAs("はなこ");
await goto(B); await settle();

check("グループの名前が、本の題のように出る",
  (await evalJs(`document.querySelector('.contents-title')?.textContent`)) === "三人のところ");

const entries = await evalJs(`[...document.querySelectorAll('.entry-title')].map(e => e.textContent)`);
check("題を付けたものは、その題が出る", entries.includes("雨の匂い") && entries.includes("三日ぶんの珈琲"), JSON.stringify(entries));
check("題が無いものは、本文の一行目を借りる", entries.includes("転職の話、まだ誰にも言っていない。"), JSON.stringify(entries));
check("借りた見出しは、一文で切れて収まる", entries.every((e) => e.length <= 45), JSON.stringify(entries.map((e) => e.length)));

check("本文そのものは出ない（目次なので）", !(await text()).includes("アスファルトが濡れる"), await text().then(s => s.slice(0, 120)));
check("目次に写真そのものは置かない",
  (await evalJs(`document.querySelectorAll('img[src^="/photo/"]').length`)) === 0);
check("だから写真を取りにもいかない",
  (await evalJs(`performance.getEntriesByType("resource").filter(r => r.name.includes("/photo/")).length`)) === 0,
  await evalJs(`performance.getEntriesByType("resource").filter(r => r.name.includes("/photo/")).map(r => r.name)`));
check("写真があることは印で分かる", (await text()).includes("写"));

check("一篇が一行（それぞれが独立した列）",
  (await evalJs(`[...document.querySelectorAll('.entry')].map(e => Math.round(e.getBoundingClientRect().left))`)).length === entries.length);

{
  const nav = await evalJs(`[...document.querySelectorAll(".masthead-link")].map(a => a.textContent.trim())`);
  check("品書きそのものは出ている（空振りでないことの確かめ）", nav.length >= 2, JSON.stringify(nav));
  check("品書きに「入っているグループ」は並べない", !nav.includes("入っているグループ"), JSON.stringify(nav));
  check("品書きに音は置かない", !nav.some((t) => t.startsWith("音")), JSON.stringify(nav));
  check("表題が、入っているグループへの戸口を兼ねる",
    (await evalJs(`document.querySelector(".masthead-title").getAttribute("href")`)) === "/");

  // 表題の頭は、中身の頭と同じ高さから始まる（字の上端そのもので見る）
  const off = await evalJs(`(() => {
    const top = (el) => { const r = document.createRange(); r.selectNodeContents(el);
      return r.getBoundingClientRect().top; };
    return String(Math.round(
      (top(document.querySelector(".masthead-title")) - top(document.querySelector(".contents-title"))) * 10) / 10);
  })()`);
  check("表題の頭が、中身の頭と揃っている", Math.abs(Number(off)) < 1.5, `${off}px ずれている`);

  check("表題を潰していない",
    (await evalJs(`getComputedStyle(document.querySelector(".masthead-title")).transform`)) === "none",
    await evalJs(`getComputedStyle(document.querySelector(".masthead-title")).transform`));
}

check("繋ぎの点線は引いていない",
  (await evalJs(`document.querySelectorAll('.entry-leader').length`)) === 0);
check("日付に罫を引いていない（一行まるごとが戸口なので）",
  (await evalJs(`(() => { const w = document.querySelector('.entry .slip-when');
    return w.tagName + "/" + getComputedStyle(w).borderBottomStyle + getComputedStyle(w).borderLeftStyle; })()`)) === "SPAN/nonenone",
  await evalJs(`(() => { const w = document.querySelector('.entry .slip-when');
    return w.tagName + "/" + getComputedStyle(w).borderBottomStyle + getComputedStyle(w).borderLeftStyle; })()`));
// 指定ではなく、実際に描かれている字の中心で見る。
// 箱が揃っていても、片側だけの余白で字がずれることがある。
{
  const off = await evalJs(`(() => {
    const ink = (el) => { const r = document.createRange(); r.selectNodeContents(el);
      const b = r.getBoundingClientRect(); return b.width ? b.left + b.width / 2 : null; };
    let worst = 0;
    for (const e of document.querySelectorAll(".entry")) {
      const t = ink(e.querySelector(".entry-title"));
      const w = ink(e.querySelector(".slip-when"));
      if (t !== null && w !== null) worst = Math.max(worst, Math.abs(t - w));
    }
    return String(Math.round(worst * 10) / 10);
  })()`);
  check("題と、その下の名前・日付が、同じ縦筋に載っている", Number(off) < 1.5, `いちばんずれて ${off}px`);
}

// ── 押すと、その一篇の頁へ移る ──
const clickEntry = async (label) => {
  const got = await evalJs(`(() => {
    const all = [...document.querySelectorAll('.entry')];
    const hit = all.find(e => e.textContent.includes(${JSON.stringify(label)}));
    if (!hit) return { ok: false, saw: all.map(e => e.textContent.trim().slice(0, 20)) };
    hit.click();
    return { ok: true };
  })()`);
  if (!got.ok) throw new Error(`「${label}」の一行が見つからない。あるのは: ` + JSON.stringify(got.saw));
};
check("一行まるごとが頁への戸口", await evalJs(`
  [...document.querySelectorAll('.entry')].every(e => e.tagName === "A" && e.getAttribute("href").startsWith("/post/"))`));

await clickEntry("三日ぶんの珈琲");
await settle(1600);
check("押すとその一篇の頁へ移る", (await path()).startsWith("/post/"), await path());
check("そこで本文が読める", (await text()).includes("台所じゅうに匂いが立って"), await text().then(s => s.slice(0, 140)));

await goto(B); await settle();
check("目次へ戻れる", (await evalJs(`document.querySelector('.contents-title')?.textContent`)) === "三人のところ");

// 題の無いものも、同じように頁へ移る
await clickEntry("古本屋、今日は");
await settle(1600);
check("題の無いものも頁へ移る", (await path()).startsWith("/post/"), await path());
check("借りていた一行は、頁では本文として出る", (await text()).includes("古本屋、今日は開いてた"), await text().then(s => s.slice(0, 140)));
check("頁では写真が出る", await evalJs(`
  (() => { const i = document.querySelector('img[src^="/photo/"]');
    return !!i && i.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true, opacityProperty: true }); })()`));
await goto(B); await settle();

// 一篇の頁へも行ける（日付から）
const first = await evalJs(`document.querySelector('.entry').getAttribute('href')`);
check("いちばん上の一篇の頁へ行ける", first.startsWith("/post/"), first);
await goto("http://localhost:3000" + first); await settle();
check("そこで本文が読める", (await text()).includes("アスファルトが濡れる"), await text().then(s => s.slice(0, 120)));
check("題も出る", (await text()).includes("雨の匂い"));
await goto(B); await settle();

// 巻物へ切り替えられる
await goto(B); await settle();
await evalJs(`[...document.querySelectorAll('a')].find(a => a.textContent.trim() === '巻物で読む').click()`);
await settle(2200);
check("巻物に切り替えられる", (await evalJs("location.search")) === "?view=maki", await evalJs("location.search"));
check("巻物では本文が全文で出る", (await text()).includes("アスファルトが濡れる"));
await evalJs(`[...document.querySelectorAll('a')].find(a => a.textContent.trim() === '目次で見る').click()`);
await settle(2200);
check("目次へ戻れる", (await evalJs("location.search")) === "" && !(await text()).includes("アスファルトが濡れる"),
  await evalJs("location.search"));

console.log("○ " + ok.join("\n○ "));
if (bad.length) console.log("\n× " + bad.join("\n× "));
console.log(bad.length ? `\n${bad.length} 件しくじりました` : `\n${ok.length} 件すべて通りました`);
await send("Target.closeTarget", { targetId });
ws.close();
