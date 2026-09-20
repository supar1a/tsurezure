// グループの名前を付けなおす。
const [, , ownerTok, memberTok] = process.argv;
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
// 同じ名前のクッキーなので、上書きすれば入れ替わる。
// 先に clearBrowserCookies を挟むと、直後の set まで消えることがある。
const as = (tok) =>
  send("Network.setCookie", { name: "tsurezure", value: tok, url: "http://localhost:3000/", path: "/" }, sessionId);
const ev = (e) => send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)
  .then((r) => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0,150)); return r.result.value; });
const goto = async (u) => {
  await send("Page.navigate", { url: u }, sessionId);
  await new Promise((r) => setTimeout(r, 2600));
  const here = await ev(`location.pathname`);
  if (here !== new URL(u).pathname) {
    console.log(`  ＜迷子＞ ${u} を開いたつもりが ${here} に居る`);
    console.log("  ＜見えているもの＞", (await ev(`document.body.innerText`)).slice(0, 100).replace(/\s+/g, " "));
  }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => ev(`document.body.innerText`);
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 160)));

const M = "http://localhost:3000/sannin/members";

// ── 作成者は付けなおせる ──
await as(ownerTok);
await goto(M);
{
  const panels = await ev(`[...document.querySelectorAll(".panel-title, .roster-heading")].map(e => e.textContent)`);
  check("作成者には、名前を変える場がある", panels.includes("名前"), JSON.stringify(panels));
  check("この頁は、グループという物の頁になっている",
    JSON.stringify(panels) === JSON.stringify(["名前", "招待する", "メンバー"]), JSON.stringify(panels));
}
check("招待 URL は変わらないと断ってある", (await text()).includes("招待 URL は変わりません"));

const urlBefore = await ev(`document.querySelector(".invite-url")?.textContent ?? "（無い）"`);
await ev(`(() => { const i = document.querySelector('form input[name="name"].input');
  i.value = "四人になった"; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
await ev(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "保存する").click()`);
await wait(3000);
check("名前が変わる", (await text()).includes("四人になった"), (await text()).slice(0, 120));
check("合鍵（招待 URL）は変わらない",
  (await ev(`document.querySelector(".invite-url").textContent`)) === urlBefore,
  `${urlBefore} → ${await ev(`document.querySelector(".invite-url").textContent`)}`);

await goto("http://localhost:3000/sannin");
check("目次の題も入れ替わる", (await text()).includes("四人になった"), (await text()).slice(0, 80));
check("中身は動いていない", (await text()).includes("雨の匂い"));
await goto("http://localhost:3000/");
check("グループの一覧も入れ替わる", (await text()).includes("四人になった"), (await text()).slice(0, 80));

// ── 長すぎる名前は受け側で弾く ──
await goto(M);
await ev(`(() => { const i = document.querySelector('form input[name="name"].input');
  i.removeAttribute("maxlength"); i.value = "あ".repeat(40);
  i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
await ev(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "保存する").click()`);
await wait(2500);
check("長すぎる名前は弾く", (await text()).includes("1〜32字"), (await text()).slice(0, 160).replace(/\s+/g, " "));

// ── 作成者でない人には出さない ──
await as(memberTok);
await goto(M);
check("作成者でない人には、名前を変える場が出ない", !(await text()).includes("グループの名前"), (await text()).slice(0, 120));

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
// すぐ exit すると、pipe に出した結果が途中で切れることがある。少し待ってから終える
process.exitCode = bad.length ? 1 : 0; setTimeout(() => process.exit(), 300);
