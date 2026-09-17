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
const path = () => evalJs("location.pathname");
const text = () => evalJs("document.body.innerText");
const fresh = () => send("Network.clearBrowserCookies", {}, sessionId);
const type = (sel, v) => evalJs(`
  (() => { const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) throw new Error("見つからない: " + ${JSON.stringify(sel)} + " @ " + location.pathname);
    el.value = ${JSON.stringify(v)}; el.focus(); return true; })()`);
const submitOf = (fieldName) => evalJs(`
  [...document.querySelectorAll('form')].find(f => f.querySelector(${JSON.stringify("[name=" + fieldName + "]")}))
    .querySelector('button[type=submit]').click()`);

const ok = [], bad = [];
const check = (label, cond, extra = "") => { console.log((cond ? "  ○ " : "  × ") + label + (cond ? "" : " ← " + String(extra).slice(0, 180))); (cond ? ok : bad).push(label + (cond ? "" : " ← " + String(extra).slice(0, 180))); };
const HOME = "http://localhost:3000/";

// ── はじめて来た人は、名前ひとつで始められる ──
await fresh();
await goto(HOME); await settle();
let t = await text();
check("いきなり口上と名乗る欄で迎えられる", t.includes("つれづれとは") && t.includes("ひとりではじめる"), t.slice(0, 100));
check("ログインという言葉が出てこない", !/ログイン|サインイン|パスワード|メールアドレス/.test(t), t);
check("聞かれるのは名前だけ",
  (await evalJs(`document.querySelectorAll("form input:not([type=hidden])").length`)) === 1,
  await evalJs(`[...document.querySelectorAll("form input:not([type=hidden])")].map(i => i.name)`));

await type("input[name=name]", "いちろう");
await submitOf("name");
await settle(3000);
check("名乗ると、そのままトップに入る", (await path()) === "/", await path());
check("ひとりのスペースが用意されている", (await text()).includes("ひとりのスペース"), await text().then(s => s.slice(0, 100)));
check("もう書ける（書き散らすの入口がある）", (await text()).includes("書き散らす"));

// ── スペースを作る ──
await goto(HOME + "new"); await settle();
await type("input[name=name]", "いちろうのところ");
await submitOf("name");
await settle(3000);
check("スペースができ、そのまま中へ入る", /^\/[a-z0-9]{8,}$/.test(await path()), await path());
const place = await path();
check("空の一覧を経由しない（もう書ける）", (await text()).includes("いちばん最初の一枚"), await text().then(s => s.slice(0, 100)));

await goto(HOME); await settle();
check("トップには、作ったスペースが並ぶ", (await text()).includes("いちろうのところ"), await text().then(s => s.slice(0, 100)));
await goto(HOME + "me"); await settle();
check("名乗りは設定に控えられている", (await evalJs(`document.querySelector('input[name=name]').value`)) === "いちろう");

// ── 招待 URL を受け取った、まだ誰でもない人 ──
await goto("http://localhost:3000" + place + "/members"); await settle();
const inviteUrl = await evalJs(`document.querySelector('.invite-url')?.textContent ?? ""`);
check("招待 URL が出る", inviteUrl.endsWith(place), inviteUrl);

await fresh();
await goto(inviteUrl); await settle();
t = await text();
check("招待 URL は誰でも開ける", t.includes("招待されています"), t.slice(0, 120));
check("そこでは名前だけ聞かれる",
  (await evalJs(`!!document.querySelector("input[name=name]")`))
    && !(await evalJs(`!!document.querySelector("input[name=placeName]")`)));
check("でも中身は見えない", !t.includes("いちばん最初の一枚") && !(await evalJs(`!!document.querySelector(".entry, .slip")`)), t);
await type("input[name=name]", "にろう");
await submitOf("name");
await settle(3000);
check("名前を入れるとそのまま仲間になる", (await path()) === place, await path());
check("中が読める", (await text()).includes("いちばん最初の一枚"), await text().then(s => s.slice(0, 100)));

// ── クッキーを失った人が、自分を選び直す ──
await fresh();
await goto(inviteUrl); await settle();
const names = await evalJs(`[...document.querySelectorAll('.pickme-people button')].map(b => b.textContent)`);
check("メンバーの名前が並ぶ", names.includes("にろう") && names.includes("いちろう"), JSON.stringify(names));
await evalJs(`[...document.querySelectorAll('.pickme-people button')].find(b => b.textContent === 'にろう').click()`);
await settle(2800);
check("選び直すと、その人として戻れる", (await path()) === place, await path());

// ── すでに仲間なら、そのまま中が出る ──
await goto(inviteUrl); await settle();
check("すでに仲間なら、そのまま中が出る", (await text()).includes("いちばん最初の一枚"), await text().then(s => s.slice(0, 100)));

// ── 名前を変える ──
await goto("http://localhost:3000/me"); await settle();
await type("input[name=name]", "にろう改");
await submitOf("name");
await settle(2800);
await goto("http://localhost:3000/me"); await settle();
check("名前を変えられる", (await evalJs(`document.querySelector('input[name=name]').value`)) === "にろう改");

// ── 設定に、あなたの持ちものが集まっている ──
await goto("http://localhost:3000/me"); await settle();
{
  const panels = await evalJs(`[...document.querySelectorAll(".panel-title")].map(e => e.textContent)`);
  check("設定に、名前・音・ログアウト が並ぶ",
    JSON.stringify(panels) === JSON.stringify(["名前", "紙の音", "ログアウト"]),
    JSON.stringify(panels));

  check("柱には音を置かない", !(await text()).match(/音 [●—]/), await text().then(t => t.slice(0, 60)));

  // 音は、押せば実際に切り替わる
  const before = await evalJs(`document.querySelector('[aria-pressed]')?.getAttribute("aria-pressed")`);
  await evalJs(`document.querySelector('[aria-pressed]').click()`);
  await settle(600);
  const after = await evalJs(`document.querySelector('[aria-pressed]')?.getAttribute("aria-pressed")`);
  check("音は、あなたの頁で切り替えられる", before !== after && after !== null, `${before} → ${after}`);
  check("切り替えたことが控えられる",
    (await evalJs(`localStorage.getItem("tsurezure.muted")`)) !== null);
}

// 表題は、どの頁からでもトップへ戻る戸口
check("表題が、入っているグループへの戸口を兼ねる",
  (await evalJs(`document.querySelector(".masthead-title")?.getAttribute("href")`)) === "/",
  await evalJs(`document.querySelector(".masthead-title")?.outerHTML?.slice(0, 80)`));

// ── このブラウザから消す ──
await goto("http://localhost:3000/me"); await settle();
await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'ログアウト').click()`);
await settle(2800);
check("ログアウトすると、また誰でもなくなる", (await text()).includes("ひとりではじめる"), await text().then(s => s.slice(0, 80)));

console.log("○ " + ok.join("\n○ "));
if (bad.length) console.log("\n× " + bad.join("\n× "));
console.log(bad.length ? `\n${bad.length} 件しくじりました` : `\n${ok.length} 件すべて通りました`);
ws.close();
