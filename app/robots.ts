import type { MetadataRoute } from "next";

/*
 * 探しものに載せてよいのは、戸口（トップ）だけ。
 *
 * スペースに入れるかどうかは URL を知っているかだけで決まる。目録に載れば、
 * 知らない人がそこへ行き着けてしまう。だから中身は、ぜんぶ断る。
 *
 * ただし、名札（OGP）を取りにくる相手は別に通す。
 * X（Twitter）も Facebook も Slack も robots.txt を見るので、まるごと断ると
 * 貼ったときに名札が出なくなる。中身は名乗らなければ見えない作りなので、
 * 通しても漏れるものはない。
 */
const CARD_BOTS = [
  "Twitterbot",
  "facebookexternalhit",
  "facebookcatalog",
  "Slackbot",
  "Slackbot-LinkExpanding",
  "LINE",
  "Discordbot",
  "WhatsApp",
  "TelegramBot",
  "SkypeUriPreview",
  "Applebot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // 探しもの：戸口だけ通して、あとは断る
      { userAgent: "*", allow: "/$", disallow: "/" },
      // 名札を取りにくる相手：どこでも通す
      { userAgent: CARD_BOTS, allow: "/" },
    ],
    sitemap: "https://tsurezure.site/sitemap.xml",
  };
}
