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
listeners.add((m) => { if (m.method === "Page.javascriptDialogOpening" && m.sessionId === sessionId)
  void send("Page.handleJavaScriptDialog", { accept: true }, sessionId); });
const evalJs = async (e) => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed"); return r.result.value; };
const goto = async (url) => { const p = new Promise((res) => { const fn = (m) => { if (m.method === "Page.loadEventFired" && m.sessionId === sessionId) { listeners.delete(fn); res(); } }; listeners.add(fn); });
  await send("Page.navigate", { url }, sessionId); await p; };
const settle = (ms = 1800) => new Promise((r) => setTimeout(r, ms));
const text = () => evalJs("document.body.innerText");
const path = () => evalJs("location.pathname");
const enterAs = async (name) => {
  await send("Network.clearBrowserCookies", {}, sessionId);
  await goto("http://localhost:3000/"); await settle(900);
  await evalJs(`[...document.querySelectorAll('.debug-btn')].find(b => b.textContent.includes(${JSON.stringify(name)})).click()`);
  await settle(2500);
};

const ok = [], bad = [];
const check = (label, cond, extra = "") => (cond ? ok : bad).push(label + (cond ? "" : " ← " + String(extra).slice(0, 180)));
const B = "http://localhost:3000/sannin";
// 巻物の中身を見る検査は、そちらの見え方に切り替えてから
const MAKI = B + "?view=maki";

await enterAs("はなこ");
await goto(MAKI); await settle();

// 自分の短冊（豆を切らして…）を開く
const href = await evalJs(`(() => {
  const s = [...document.querySelectorAll('.slip')].find(x => x.textContent.includes("豆を切らして"));
  return s?.querySelector('.slip-when')?.getAttribute('href') ?? "";
})()`);
check("自分の短冊をひらける", href.startsWith("/post/"), href);
{
  // 巻物の上で、自分のものだと分かり、そこが戸口だと見えているか
  const mine = await evalJs(`(() => {
    const s = [...document.querySelectorAll('.slip')].find(x => x.textContent.includes("豆を切らして"));
    return { mark: !!s.querySelector('.slip-mine'), line: getComputedStyle(s.querySelector('.slip-when')).borderBlockEndColor };
  })()`);
  check("自分の投稿には「じぶん」が付く", mine.mark, JSON.stringify(mine));
  check("日付は触る前から戸口に見える（線が出ている）", !/rgba\(0, 0, 0, 0\)|transparent/.test(mine.line), mine.line);
  const others = await evalJs(`(() => {
    const s = [...document.querySelectorAll('.slip')].find(x => x.textContent.includes("駅前の古本屋"));
    return !!s.querySelector('.slip-mine');
  })()`);
  check("他人の投稿には付かない", !others);
}
await goto("http://localhost:3000" + href); await settle();
// 一篇にできることは、柱ではなく読み終えた先（本文の末）に置いてある
const foot = await evalJs(`[...document.querySelectorAll('.sheet-foot button, .sheet-foot a')].map(e => e.textContent.trim())`);
check("自分の投稿には、読み終えた先に 編集・下書きに戻す・削除 がある",
  foot.includes("削除") && foot.includes("編集") && foot.includes("下書きに戻す"), JSON.stringify(foot));
const nav = await evalJs(`[...document.querySelectorAll('.masthead-nav button, .masthead-nav a')].map(e => e.textContent.trim())`);
check("柱には、いま居るところへの道だけ", JSON.stringify(nav) === JSON.stringify(["グループへ戻る"]), JSON.stringify(nav));

await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '削除').click()`);
await settle(3000);
check("削除するとグループに戻る", (await path()) === "/sannin", await path());
check("消えている", !(await text()).includes("豆を切らして"), (await text()).slice(0, 120));
check("開き直しても消えたまま", await (async () => {
  await goto(MAKI); await settle(1400);
  return !(await text()).includes("豆を切らして");
})());

// 他人の短冊には出ない
await enterAs("たろう");
await goto(MAKI); await settle();
const other = await evalJs(`(() => {
  const s = [...document.querySelectorAll('.slip')].find(x => x.textContent.includes("駅前の古本屋"));
  return s?.querySelector('.slip-when')?.getAttribute('href') ?? "";
})()`);
await goto("http://localhost:3000" + other); await settle();
check("他人の短冊には削除が出ない", !(await evalJs(`[...document.querySelectorAll('button')].map(b => b.textContent.trim())`)).includes("削除"));

console.log("○ " + ok.join("\n○ "));
if (bad.length) console.log("\n× " + bad.join("\n× "));
console.log(bad.length ? `\n${bad.length} 件しくじりました` : `\n${ok.length} 件すべて通りました`);
ws.close();
