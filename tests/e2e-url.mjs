// 本文に書かれた URL は、そのまま戸口になる。
// 打った文字は書き換えない。末尾の句読点や閉じ括弧は行き先に含めない。
const [, , token, slipId] = process.argv;
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
const path = () => ev(`location.pathname`);
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 200)));

const B = "http://localhost:3000";
const put = (sel, v) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) throw new Error("見つからない: " + ${JSON.stringify(sel)} + " @ " + location.pathname);
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, ${JSON.stringify(v)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return el.value;
})()`);

const BODY = [
  "今日はここを見た。https://example.com/a/b?c=1。",
  "（https://example.org/x）",
  "https://example.net/y、と「https://example.com/z」",
  "http://example.com/plain",
  "example.com や ftp://example.com は戸口にならない",
  "文の途中の https://example.com/mid の続き",
  "https://ja.wikipedia.org/wiki/徒然草 のような漢字かなの行き先は切らない",
].join("\n");
const WANT = [
  "https://example.com/a/b?c=1",
  "https://example.org/x",
  "https://example.net/y",
  "https://example.com/z",
  "http://example.com/plain",
  "https://example.com/mid",
  "https://ja.wikipedia.org/wiki/徒然草",
];

// ── 自分の一枚を書き直して、URL を並べる ──
await goto(`${B}/post/${slipId}/edit`);
await put(".compose-body", BODY);
await ev(`document.querySelector(".compose-foot > button").click()`); await wait(400);
await ev(`document.querySelector("dialog[open] button[type=submit]")?.click()`);
await wait(3000);
check("書き直せている", (await path()) === `/post/${slipId}`, await path());

const links = () => ev(`[...document.querySelectorAll(".sheet-body a.link")].map(a => ({
  href: a.getAttribute("href"), text: a.textContent, target: a.getAttribute("target"), rel: a.getAttribute("rel"),
  next: a.nextSibling?.textContent?.slice(0, 3) ?? "",
  color: getComputedStyle(a).color, around: getComputedStyle(a.parentElement).color,
}))`);
const got = await links();

check("URL の数だけ戸口ができる", got.length === WANT.length, `${got.length} 個: ${JSON.stringify(got.map((g) => g.href))}`);
check("行き先が、書いた URL そのもの", JSON.stringify(got.map((g) => g.href)) === JSON.stringify(WANT), JSON.stringify(got.map((g) => g.href)));
check("見える文字も書き換えていない（行き先と同じ字）", got.every((g) => g.text === g.href), JSON.stringify(got.map((g) => g.text)));
check("末尾の句点は行き先に含めず、字としては残る", got[0]?.next.startsWith("。"), JSON.stringify(got[0]));
check("閉じ括弧も含めない（）", got[1]?.next.startsWith("）"), JSON.stringify(got[1]));
check("読点も含めない", got[2]?.next.startsWith("、"), JSON.stringify(got[2]));
check("鉤括弧も含めない（」）", got[3]?.next.startsWith("」"), JSON.stringify(got[3]));
check("http でも戸口になる", got[4]?.href === "http://example.com/plain", JSON.stringify(got[4]));
check("漢字かなを含む行き先は、切らずにそのまま", got[6]?.href === "https://ja.wikipedia.org/wiki/徒然草", JSON.stringify(got[6]));
check("別の窓でひらく", got.every((g) => g.target === "_blank"), JSON.stringify(got.map((g) => g.target)));
check("行き先に、ここの URL を渡さない（noreferrer）", got.every((g) => (g.rel ?? "").includes("noreferrer")), JSON.stringify(got.map((g) => g.rel)));
check("藍色で、地の文と見分けがつく", got.every((g) => g.color !== g.around), JSON.stringify(got[0]));
check("下線は引かない（見えかたが変わるだけ）", (await ev(`getComputedStyle(document.querySelector(".sheet-body a.link")).textDecorationLine`)) === "none");

// 戸口にならないもの
{
  const t = await ev(`document.querySelector(".sheet-body").innerText`);
  check("http の無い example.com は字のまま", t.includes("example.com や") && !got.some((g) => g.href === "example.com"));
  check("ftp:// は戸口にしない", !got.some((g) => g.href.startsWith("ftp://")));
  check("本文の字はまるごと残っている",
    ["今日はここを見た。", "文の途中の", "の続き", "戸口にならない"].every((s) => t.includes(s)), t.slice(0, 120));
}

// ── 巻物の上でも同じ ──
await goto(`${B}/sannin?view=maki`);
{
  const n = await ev(`(() => {
    const s = [...document.querySelectorAll(".slip")].find(x => x.textContent.includes("今日はここを見た"));
    return s ? s.querySelectorAll(".slip-body a.link").length : -1;
  })()`);
  check("巻物の上でも同じ数の戸口", n === WANT.length, n);
}

// ── 書き直しの欄には、打った字がそのまま戻る ──
await goto(`${B}/post/${slipId}/edit`);
check("書き直しの欄に、打った字がそのまま戻る", (await ev(`document.querySelector(".compose-body").value`)) === BODY,
  (await ev(`document.querySelector(".compose-body").value`)).slice(0, 80));

// ── 目次では戸口にしない（一行まるごとが一篇への戸口なので） ──
await goto(`${B}/sannin`);
{
  const inner = await ev(`(() => {
    const e = [...document.querySelectorAll(".entry")].find(x => x.textContent.includes("雨の匂い"));
    return e ? e.querySelectorAll("a").length : -1;
  })()`);
  check("目次の一行の中に、別の戸口は無い", inner === 0, inner);
}

await send("Target.closeTarget", { targetId }); ws.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
clearTimeout(bail);
process.exit(bad.length ? 1 : 0);
