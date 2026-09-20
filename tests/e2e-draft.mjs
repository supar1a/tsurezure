// 書きかけの守り：戻ろうとするとたずねる／控えが残り、次に戻せる
const tok = process.env.TOK;
const version = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const ws = new WebSocket(version.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let seq = 0; const waiters = new Map(); const listeners = new Set(); let lastDialog = "";
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } else listeners.forEach((f) => f(m)); };
const send = (method, params = {}, sid) => new Promise((res, rej) => { const id = ++seq; waiters.set(id, (m) => (m.error ? rej(new Error(method + JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId); await send("Runtime.enable", {}, sessionId); await send("Network.enable", {}, sessionId);
let accept = false;
listeners.add((m) => { if (m.method === "Page.javascriptDialogOpening" && m.sessionId === sessionId) { lastDialog = m.params.message; void send("Page.handleJavaScriptDialog", { accept }, sessionId); } });
await send("Network.setCookie", { name: "tsurezure", value: tok, domain: "localhost", path: "/" }, sessionId);
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }, sessionId)).result.value;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const goto = async (u) => { await send("Page.navigate", { url: u }, sessionId); await wait(2600); };
const type = async (t) => { await ev(`document.querySelector(".compose-body").focus()`); await send("Input.insertText", { text: t }, sessionId); await wait(400); };
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 200)));
const B = "http://localhost:3000";

await goto(B + "/write");
await ev(`localStorage.removeItem("tsurezure.draft")`);
await goto(B + "/write");
check("はじめは、書きかけの差し出しは出ない", !(await ev(`!!document.querySelector(".compose-draft")`)));

await type("書きかけの一枚。");
// やめるを押す：断れば留まる
accept = false; lastDialog = "";
await ev(`[...document.querySelectorAll("a")].find(a => a.textContent.trim() === "やめる").click()`); await wait(1500);
check("やめるを押すと、たずねてくる", lastDialog.includes("書きかけ"), lastDialog);
check("断れば、書く場に留まる", (await ev("location.pathname")) === "/write", await ev("location.pathname"));
check("書いたものはそのまま", (await ev(`document.querySelector(".compose-body").value`)).includes("書きかけの一枚"));

// 受ければ戻る
await wait(1200);
accept = true;
await ev(`[...document.querySelectorAll("a")].find(a => a.textContent.trim() === "やめる").click()`); await wait(2600);
check("受ければ、ひとりのスペースへ戻る", (await ev("location.pathname")) === "/private", await ev("location.pathname"));
check("控えは残っている", !!(await ev(`localStorage.getItem("tsurezure.draft")`)));

// 戻ってくると差し出される
await goto(B + "/write"); await wait(600);
check("次に書くとき、書きかけを差し出す", await ev(`!!document.querySelector(".compose-draft")`));
await ev(`[...document.querySelectorAll(".compose-draft button")].find(b => b.textContent.trim() === "戻す").click()`); await wait(600);
check("戻すと、書きかけが戻る", (await ev(`document.querySelector(".compose-body").value`)).includes("書きかけの一枚"));
check("差し出しの一行は消える", !(await ev(`!!document.querySelector(".compose-draft")`)));

// 捨てる
await ev(`localStorage.removeItem("tsurezure.draft")`);
await goto(B + "/write"); await type("捨てる用。"); await wait(900);
await goto(B + "/write"); await wait(600);
check("また差し出される", await ev(`!!document.querySelector(".compose-draft")`));
await ev(`[...document.querySelectorAll(".compose-draft button")].find(b => b.textContent.trim() === "捨てる").click()`); await wait(400);
check("捨てると、控えも消える", !(await ev(`localStorage.getItem("tsurezure.draft")`)));

// 何も書いていなければ、たずねない
await goto(B + "/write"); accept = false; lastDialog = "";
await ev(`[...document.querySelectorAll("a")].find(a => a.textContent.trim() === "やめる").click()`); await wait(2600);
check("何も書いていなければ、たずねずに戻る", lastDialog === "" && (await ev("location.pathname")) === "/private", `${lastDialog} ${await ev("location.pathname")}`);

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
process.exitCode = bad.length ? 1 : 0; setTimeout(() => process.exit(), 300);
