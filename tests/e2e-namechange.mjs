// 自分の名前を変える。照合するものがないので、いつでも変えられる。
// 変えたあとも同じ人のままか（クッキー・下書き）。書いたものの名前も付け替わるか。
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
const ev = (e) => send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)
  .then((r) => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0,150)); return r.result.value; });
const goto = async (u) => { await send("Page.navigate", { url: u }, sessionId); await new Promise((r) => setTimeout(r, 2400)); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => ev(`document.body.innerText`);
const path = () => ev(`location.pathname`);
const cookie = async () => (await send("Network.getCookies", { urls: ["http://localhost:3000/"] }, sessionId)).cookies.find((c) => c.name === "tsurezure")?.value;
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 160)));

const B = "http://localhost:3000";
const ME = `${B}/me`;
const NAME = 'form input[name="name"].input';

const put = (v, { loosen = false } = {}) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(NAME)});
  if (!el) throw new Error("名前の欄が無い @ " + location.pathname);
  if (${loosen}) { el.removeAttribute("maxlength"); el.removeAttribute("required"); }
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(v)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return el.value;
})()`);
const save = () => ev(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "保存する").click()`);
const rename = async (v, opts) => { await goto(ME); await put(v, opts); await save(); await wait(3000); };

// ── いまの名前が入った状態で始まる ──
await goto(ME);
check("いまの名前が欄に入っている", (await ev(`document.querySelector(${JSON.stringify(NAME)}).value`)) === "はなこ");
check("欄の上限は 24 字", (await ev(`document.querySelector(${JSON.stringify(NAME)}).maxLength`)) === 24);
const before = await cookie();

// ── 変える ──
await rename("はなこ改");
check("変えると、入っているグループの一覧に戻る", (await path()) === "/", await path());
check("柱の名乗りが変わる", (await text()).includes("はなこ改 さん"), (await text()).slice(0, 80));
check("クッキーは変わらない（同じ人のまま）", (await cookie()) === before, `${before?.slice(0, 8)} → ${(await cookie())?.slice(0, 8)}`);

// 書いたものの名前も付け替わる
await goto(`${B}/sannin?view=maki`);
{
  const who = await ev(`[...document.querySelectorAll(".slip-who")].map(e => e.textContent.trim())`);
  check("巻物で、自分の書いたものの名前が付け替わる", who.includes("はなこ改"), JSON.stringify(who));
  check("前の名前は一つも残らない", !who.includes("はなこ"), JSON.stringify(who));
  check("ほかの人の名前は動かない", who.includes("たろう") && who.includes("じろう"), JSON.stringify(who));
  check("下書きも自分のものとして見えたまま（同じ人）", (await text()).includes("まだ途中"), (await text()).slice(0, 120));
}
await goto(`${B}/sannin`);
check("目次でも付け替わる",
  (await ev(`[...document.querySelectorAll(".entry-meta")].some(e => e.textContent.includes("はなこ改"))`)));
await goto(`${B}/sannin/members`);
{
  const t = await text();
  check("メンバーの並びでも付け替わる", t.includes("はなこ改") && t.includes("たろう") && t.includes("じろう"), t.slice(0, 160));
}
{
  await goto(`${B}/sannin`);
  const href = await ev(`[...document.querySelectorAll(".entry")].find(x => x.textContent.includes("雨の匂い"))?.getAttribute("href")`);
  await goto(B + href);
  check("一篇の頁の名前も付け替わる", (await ev(`document.querySelector(".sheet-who")?.textContent?.trim()`)) === "はなこ改");
}

// ── 前後の空白は落とす（全角も） ──
await rename("　 さくら 　");
check("前後の空白（全角も）は落とす", (await text()).includes("さくら さん") && !(await text()).includes("　さくら"), (await text()).slice(0, 80));

// ── 長さ ──
await rename("あ".repeat(24));
check("24 字はそのまま通る", (await text()).includes("あ".repeat(24) + " さん"), (await text()).slice(0, 80));

await rename("あ".repeat(25), { loosen: true });
check("25 字は受け側で弾く", (await path()) === "/me" && (await text()).includes("名前は1〜24字"), `${await path()} ${(await text()).slice(0, 120).replace(/\s+/g, " ")}`);
check("弾かれても、名前は前のまま", await (async () => { await goto(B + "/"); return (await text()).includes("あ".repeat(24) + " さん"); })());

await rename("", { loosen: true });
check("空は受け側で弾く", (await path()) === "/me" && (await text()).includes("名前は1〜24字"), `${await path()}`);

await rename("　　", { loosen: true });
check("空白だけも弾く", (await path()) === "/me" && (await text()).includes("名前は1〜24字"), `${await path()}`);

// 欄に required が付いているので、ふつうは空のまま送れない
await goto(ME);
await put("");
await save();
await wait(1200);
check("欄が空のときは、そもそも送りにいかない（required）", (await path()) === "/me" && !(await text()).includes("名前は1〜24字"), await path());

// ── 元に戻しておく ──
await rename("はなこ");
check("元の名前に戻せる", (await text()).includes("はなこ さん"), (await text()).slice(0, 80));

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
process.exit(bad.length ? 1 : 0);
