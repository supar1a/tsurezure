// iOS の WebKit で、巻きの中のものが指で押せるか。
//
// Chrome では起きない。縦組みの器が原点（右端）以外へ送られていると、WebKit は中のものに
// 触れた瞬間に原点へ引き戻し、click が別の場所に落ちる。器を横組みにして避けているが、
// その効き目は WebKit でしか確かめられないので、この一本だけ Playwright の WebKit で走らせる。
//
// 使いかた（npm test には入れていない。playwright と WebKit の取り寄せが要るので）:
//   npm i --no-save playwright && npx playwright install webkit
//   npm run dev を 3000 番で走らせ、npm run seed を入れておく
//   node tests/webkit-tap.mjs <はなこの token> <はなこの一篇の id>
//   （token と id は tests/run.mjs と同じ作りかたで取れる）
let pw;
try {
  pw = await import("playwright");
} catch {
  console.log("playwright が無い。npm i --no-save playwright && npx playwright install webkit");
  process.exit(2);
}
const [, , token, slipId] = process.argv;
const B = "http://localhost:3000";
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 160)));

const browser = await pw.webkit.launch();
const ctx = await browser.newContext({ ...pw.devices["iPhone 13"], locale: "ja-JP" });
await ctx.addCookies([{ name: "tsurezure", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const geo = () => page.evaluate(() => { const s = document.querySelector(".scroll-tate"), t = s.querySelector("[data-stream]"); const r = t.getBoundingClientRect(), v = s.getBoundingClientRect(); return { sl: Math.round(s.scrollLeft), left: Math.round(r.left - v.left), right: Math.round(r.right - v.right) }; });
const tapAt = async (r) => { await page.touchscreen.tap(r.x, r.y); await page.waitForTimeout(2500); };

// ── 巻物：ひらいた位置と、送った先の日付 ──
await page.goto(`${B}/sannin?view=maki`); await page.waitForTimeout(3000);
check("巻物は左端（原点）でひらく", (await geo()).sl === 0 && Math.abs((await geo()).left) < 3, JSON.stringify(await geo()));
await page.waitForTimeout(6000); // ひらいた直後の見張り（8秒）が手を引くまで待つ
for (const px of [300, 1200]) {
  await page.evaluate((px) => { document.querySelector(".scroll-tate").scrollLeft = px; }, px); await page.waitForTimeout(600);
  const r = await page.evaluate(() => { const v = document.querySelector(".scroll-tate").getBoundingClientRect(); const a = [...document.querySelectorAll(".slip-when")].map(e => ({ e, r: e.getBoundingClientRect() })).find(({ r }) => r.left >= v.left && r.right <= v.right); if (!a) return null; return { x: a.r.x + a.r.width / 2, y: a.r.y + a.r.height / 2, href: a.e.getAttribute("href") }; });
  if (!r) { check(`${px}px 送った先に日付がある`, false, "画面内に日付が無い"); continue; }
  await tapAt(r);
  check(`${px}px 送った先で、日付を押して一篇へ移れる`, page.url().includes(r.href), page.url());
  await page.goto(`${B}/sannin?view=maki`); await page.waitForTimeout(9000);
}

// ── 一篇：題からひらき、帯まで送って「編集」を押す ──
await page.goto(`${B}/post/${slipId}`); await page.waitForTimeout(2500);
check("一篇は右端（はじまり）でひらく", Math.abs((await geo()).right) < 3, JSON.stringify(await geo()));
await page.waitForTimeout(6500);
await page.evaluate(() => { document.querySelector(".scroll-tate").scrollLeft = 0; }); await page.waitForTimeout(600);
check("帯まで送れる（位置は 0）", (await geo()).sl === 0 && Math.abs((await geo()).left) < 3, JSON.stringify(await geo()));
const e = await page.evaluate(() => { const a = [...document.querySelectorAll(".sheet-foot a")].find(x => x.textContent.trim() === "編集"); const b = a.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, in: b.x >= 0 && b.right <= innerWidth }; });
check("帯の「編集」が画面の中にある", e.in, JSON.stringify(e));
await tapAt(e);
check("「編集」を指で押すと、書き直しの頁へ移る", page.url().endsWith("/edit"), page.url());
// 帯の button（削除）も反応する
await page.goto(`${B}/post/${slipId}`); await page.waitForTimeout(9000);
await page.evaluate(() => { document.querySelector(".scroll-tate").scrollLeft = 0; }); await page.waitForTimeout(600);
let asked = false; page.on("dialog", async (d) => { asked = true; await d.dismiss(); });
const del = await page.evaluate(() => { const a = [...document.querySelectorAll(".sheet-foot button")].find(x => x.textContent.trim() === "削除"); const b = a.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
await page.touchscreen.tap(del.x, del.y); await page.waitForTimeout(1500);
check("帯の「削除」（button）も指に反応する", asked);

await browser.close();
for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
process.exit(bad.length ? 1 : 0);
