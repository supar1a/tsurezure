// 書く欄で打った印がその場で変わるか、Enter で続くか、読むときに印として組まれるか、本人が反転できるか
const tok = process.env.TOK;
const version = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const ws = new WebSocket(version.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let seq = 0; const waiters = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } };
const send = (method, params = {}, sid) => new Promise((res, rej) => { const id = ++seq; waiters.set(id, (m) => (m.error ? rej(new Error(method + JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId); await send("Runtime.enable", {}, sessionId); await send("Network.enable", {}, sessionId);
await send("Network.setCookie", { name: "tsurezure", value: tok, domain: "localhost", path: "/" }, sessionId);
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0, 200)); return r.result.value; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const goto = async (u) => { await send("Page.navigate", { url: u }, sessionId); await wait(2600); };
const type = async (t) => { await send("Input.insertText", { text: t }, sessionId); await wait(80); };
const enter = async () => { await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" }, sessionId); await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }, sessionId); await wait(80); };
const body = () => ev(`document.querySelector(".compose-body").value`);
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 200)));

await goto("http://localhost:3000/write");
await ev(`document.querySelector(".compose-body").focus()`);
await type("- "); check("「- 」を打つと、その場で「・」になる", (await body()) === "・", await body());
await type("りんご"); await enter(); check("Enter で次の行にも「・」", (await body()) === "・りんご\n・", JSON.stringify(await body()));
await type("みかん"); await enter(); await enter(); check("空の項目で Enter すると、印が消えて終わる", (await body()) === "・りんご\n・みかん\n", JSON.stringify(await body()));
await type("1. "); check("「1. 」は「一、」になる", (await body()).endsWith("一、"), JSON.stringify(await body()));
await type("朝"); await enter(); check("Enter で「二、」", (await body()).endsWith("一、朝\n二、"), JSON.stringify(await body()));
await type("昼"); await enter(); await enter();
await type("[ ] "); check("「[ ] 」は「☐ 」になる", (await body()).endsWith("☐ "), JSON.stringify(await body()));
await type("牛乳"); await enter(); await type("[x] "); check("「[x] 」は「☑ 」になる", (await body()).endsWith("☑ "), JSON.stringify(await body()));
await type("卵"); await enter(); await enter();
await type("---"); await enter(); await type("線のあと");
const final = await body();
check("本文には見える字だけが残る（記法を隠し持たない）", !/^- |\[ \]|\[x\]|^1\. /m.test(final), JSON.stringify(final));

// 送る
await ev(`document.querySelector(".compose-foot > button").click()`); await wait(400);
await ev(`document.querySelector("dialog[open] button[type=submit]")?.click()`); await wait(3500);
check("送るとひとりのスペースへ", (await ev("location.pathname")) === "/private", await ev("location.pathname"));

// 読む（巻物）
await goto("http://localhost:3000/private?view=maki");
const marked = await ev(`(() => { const b = [...document.querySelectorAll(".slip-body")].findLast(x => x.textContent.includes("りんご")); if (!b) return null;
  const ps = [...b.querySelectorAll("p")]; return { marks: ps.map(p => p.querySelector(".line-mark")?.textContent?.trim() ?? ""), classes: ps.map(p => p.className), hr: b.querySelectorAll("hr").length, indent: ps.filter(p => p.classList.contains("line-marked")).map(p => getComputedStyle(p).textIndent) }; })()`);
check("巻物で、印のある行は印が別に立つ", marked && JSON.stringify(marked.marks.slice(0, 6)) === JSON.stringify(["・", "・", "一、", "二、", "☐", "☑"]), JSON.stringify(marked));
check("印の行はぶら下げ（負の字下げ）", marked && marked.indent.every((v) => parseFloat(v) < 0), JSON.stringify(marked?.indent));
check("--- は罫になる", marked && marked.hr === 1, JSON.stringify(marked));

// 一篇の頁で、本人が反転できる
const href = await ev(`[...document.querySelectorAll(".slip")].findLast(s => s.textContent.includes("りんご"))?.querySelector(".slip-when")?.getAttribute("href")`);
await goto("http://localhost:3000" + href);
const before = await ev(`[...document.querySelectorAll("button.line-check")].map(b => b.textContent)`);
check("本人にはチェックが釦になっている", JSON.stringify(before) === JSON.stringify(["☐", "☑"]), JSON.stringify(before));
await ev(`document.querySelector("button.line-check").click()`); await wait(2500);
const after = await ev(`[...document.querySelectorAll("button.line-check")].map(b => b.textContent)`);
check("押すと反転して、保存される", JSON.stringify(after) === JSON.stringify(["☑", "☑"]), JSON.stringify(after));
await goto("http://localhost:3000" + href);
check("開き直しても反転したまま", JSON.stringify(await ev(`[...document.querySelectorAll("button.line-check")].map(b => b.textContent)`)) === JSON.stringify(["☑", "☑"]));

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
// すぐ exit すると、pipe に出した結果が途中で切れることがある。少し待ってから終える
process.exitCode = bad.length ? 1 : 0; setTimeout(() => process.exit(), 300);
