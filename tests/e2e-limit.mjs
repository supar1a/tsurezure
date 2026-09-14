// 上限。題は 40 字、グループ名は 32 字。打ち込みの上限・受け側の検め・残り字数の三つが揃っているか。
// 本文の字数は空白を数えない。空のままは受け取らない。
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
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 160)));

const B = "http://localhost:3000";
const W = `${B}/sannin/write`;

const put = (sel, v, { loosen = false } = {}) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) throw new Error("見つからない: " + ${JSON.stringify(sel)} + " @ " + location.pathname);
  if (${loosen}) { el.removeAttribute("maxlength"); el.removeAttribute("required"); }
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(v)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return el.value;
})()`);
const press = (label) => ev(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`);
const counts = () => ev(`[...document.querySelectorAll(".compose-count")].map(e => e.textContent)`);
const notice = () => ev(`[...document.querySelectorAll(".notice")].map(e => e.textContent).join(" / ")`);

// ── 題：打ち込みの上限と、残りの見せかた ──
await goto(W);
check("題の欄の打ち込みは 40 字まで", (await ev(`document.querySelector(".compose-title").maxLength`)) === 40);
check("はじめは残り字数を出さない（急かさない）", !(await counts()).some((c) => c.includes("題はあと")), JSON.stringify(await counts()));
await put(".compose-title", "あ".repeat(29));
check("29 字でもまだ出さない", !(await counts()).some((c) => c.includes("題はあと")), JSON.stringify(await counts()));
await put(".compose-title", "あ".repeat(30));
check("残り 10 字になったら「題はあと10字」", (await counts()).includes("題はあと10字"), JSON.stringify(await counts()));
await put(".compose-title", "あ".repeat(40));
check("いっぱいで「題はあと0字」", (await counts()).includes("題はあと0字"), JSON.stringify(await counts()));
await put(".compose-title", "短い題");
check("短くすればまた消える", !(await counts()).some((c) => c.includes("題はあと")), JSON.stringify(await counts()));

// ── 本文の字数：空白は数えない ──
check("何も書いていなければ字数は出さない", !(await counts()).some((c) => /\d+字$/.test(c)), JSON.stringify(await counts()));
await put(".compose-body", "あいう えお\nかき　く");
check("空白と改行（全角空白も）は数えない", (await counts()).includes("8字"), JSON.stringify(await counts()));
await put(".compose-body", "😀と絵文字");
check("絵文字も一字と数える", (await counts()).includes("5字"), JSON.stringify(await counts()));

// ── 題：受け側でも 40 字を検める（打ち込みの上限をすり抜けても） ──
await put(".compose-title", "い".repeat(41), { loosen: true });
await put(".compose-body", "長すぎる題の本文");
await press("書き残す");
await wait(2800);
check("41 字の題は受け側で断る", (await path()) === "/sannin/write" && (await notice()).includes("題は40字までです"), `${await path()} ${await notice()}`);
await goto(`${B}/sannin`);
check("断られたものは残っていない", !(await text()).includes("長すぎる題の本文") && !(await text()).includes("い".repeat(41)), (await text()).slice(0, 120));

// 40 字ちょうどは通る
await goto(W);
await put(".compose-title", "う".repeat(40));
await put(".compose-body", "ちょうどの題の本文");
await press("書き残す");
await wait(3000);
check("40 字ちょうどの題は通る", (await path()) === "/sannin" && (await text()).includes("う".repeat(40)), `${await path()}`);

// ── 本文：空のままは受け取らない ──
await goto(W);
await press("書き残す");
await wait(2500);
check("空のまま送ると「まだ何も書かれていません」", (await path()) === "/sannin/write" && (await notice()).includes("まだ何も書かれていません"), `${await path()} ${await notice()}`);
await put(".compose-body", " \n　\n ");
await press("書き残す");
await wait(2500);
check("空白だけでも同じ", (await path()) === "/sannin/write" && (await notice()).includes("まだ何も書かれていません"), `${await path()} ${await notice()}`);
await put(".compose-title", "題だけ");
await put(".compose-body", "");
await press("書き残す");
await wait(2500);
check("題だけでも、本文が無ければ受け取らない", (await path()) === "/sannin/write" && (await notice()).includes("まだ何も書かれていません"), `${await path()} ${await notice()}`);
await goto(`${B}/sannin`);
check("題だけのものは残っていない", !(await text()).includes("題だけ"), (await text()).slice(0, 120));

// 下書きも同じく空は受け取らない
await goto(W);
await press("下書きに保存");
await wait(2500);
check("下書きでも空は受け取らない", (await path()) === "/sannin/write" && (await notice()).includes("まだ何も書かれていません"), `${await path()}`);

// ── グループ名：32 字 ──
const NEW = `${B}/new`;
await goto(NEW);
check("グループ名の打ち込みは 32 字まで", (await ev(`document.querySelector('input[name="name"]').maxLength`)) === 32);
await put('input[name="name"]', "え".repeat(33), { loosen: true });
await press("作成する");
await wait(2800);
check("33 字は受け側で断る", (await path()) === "/new" && (await notice()).includes("グループ名は1〜32字"), `${await path()} ${await notice()}`);
await put('input[name="name"]', "　　", { loosen: true });
await press("作成する");
await wait(2800);
check("空白だけも断る", (await path()) === "/new" && (await notice()).includes("グループ名は1〜32字"), `${await path()} ${await notice()}`);
await put('input[name="name"]', "お".repeat(32));
await press("作成する");
await wait(3200);
check("32 字ちょうどは通り、そのまま中へ入る", /^\/[a-z0-9]{8,}$/.test(await path()), await path());
await goto(B + "/");
check("できたグループが一覧に並ぶ", (await text()).includes("お".repeat(32)), (await text()).slice(0, 120));

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
process.exit(bad.length ? 1 : 0);
