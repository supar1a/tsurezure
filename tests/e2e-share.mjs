// 分かち合うときに、何が出て、何が出ないか。
// 名札は名乗る前でも取りに来られるので、ここに書いたものは
// URL を受け取った人みんなに見える。
const [, , token, slipId] = process.argv;
const B = "http://localhost:3000";
const ok = [], bad = [];
const check = (l, c, x = "") => (c ? ok : bad).push(l + (c ? "" : " ← " + String(x).slice(0, 200)));

// 名乗らずに取りにいく（LINE や Slack の仕組みと同じ立場で）
const head = async (path, asMember = false) => {
  const r = await fetch(B + path, { headers: asMember ? { Cookie: `tsurezure=${token}` } : {} });
  const html = await r.text();
  const one = (re) => (html.match(re) || [])[1] ?? null;
  return {
    title: one(/<title>([^<]*)<\/title>/),
    ogTitle: one(/property="og:title" content="([^"]*)"/),
    ogImage: one(/property="og:image" content="([^"]*)"/),
    ogType: one(/property="og:type" content="([^"]*)"/),
    ogSite: one(/property="og:site_name" content="([^"]*)"/),
    robots: one(/name="robots" content="([^"]*)"/),
    html,
  };
};

// ── グループ：名前は出る。中身は出ない。 ──
{
  const m = await head("/sannin");
  check("グループの頁に、グループの名前が出る", m.title === "三人のところ — つれづれ", m.title);
  check("名札にも名前が出る", m.ogTitle === "三人のところ — つれづれ", m.ogTitle);
  check("名札の絵が付く", !!m.ogImage && m.ogImage.includes("opengraph-image"), m.ogImage);
  check("名札の種別と場の名も落ちていない", m.ogType === "website" && m.ogSite === "つれづれ", `${m.ogType} / ${m.ogSite}`);
  check("探しものからは外してある", m.robots === "noindex, nofollow", m.robots);
  check("名乗らない相手に、中身は渡さない", !m.html.includes("アスファルトが濡れる"), "本文が名札の頁に出ている");
}

// ── 一篇：何も出さない ──
{
  const m = await head(`/post/${slipId}`);
  check("一篇の頁の名札に、題を出さない", !String(m.title).includes("雨の匂い") && !String(m.ogTitle).includes("雨の匂い"),
    `${m.title} / ${m.ogTitle}`);
  check("一篇の頁の名札に、グループの名前も出さない",
    !String(m.title).includes("三人のところ") && !String(m.ogTitle).includes("三人のところ"),
    `${m.title} / ${m.ogTitle}`);
  check("題も本文も、名乗らない相手には渡さない",
    !m.html.includes("アスファルトが濡れる") && !m.html.includes("雨の匂い"), "中身が出ている");
  check("それでも名札の絵は付く", !!m.ogImage, m.ogImage);
}

// ── メンバーだった場合は、ちゃんと読める ──
{
  const m = await head(`/post/${slipId}`, true);
  check("メンバーには、いつもどおり読める", m.html.includes("アスファルトが濡れる"));
}

// ── 目録に載らない ──
{
  const r = await fetch(B + "/robots.txt");
  const t = await r.text();
  check("robots.txt がまるごと断っている", /User-Agent:\s*\*/i.test(t) && /Disallow:\s*\/$/m.test(t), t.slice(0, 80));
}

// ── 名札の絵そのもの ──
{
  const r = await fetch(B + "/opengraph-image.png");
  check("名札の絵が取り出せる", r.ok && (r.headers.get("content-type") || "").includes("image/png"),
    `${r.status} ${r.headers.get("content-type")}`);
}

for (const l of ok) console.log("  ○ " + l);
for (const l of bad) console.log("  × " + l);
console.log(bad.length ? `${bad.length} 件しくじりました` : `${ok.length} 件すべて通りました`);
process.exit(bad.length ? 1 : 0);
