/*
 * 分かち合うときに出る名札。
 *
 * Next.js は openGraph を頁ごとに上書きする。混ぜてはくれないので、
 * 題だけ差し替えたいときも、絵や種別を毎回そろえて渡す必要がある。
 * 取りこぼしが起きないよう、作るのはここ一か所に寄せてある。
 */
export const SITE = "つれづれ";
/** 名札と、探しものの一行。戸口の口上と揃える。 */
export const ABOUT = "日々のことや、ふと思ったことを、縦書きで残しておける場所。ひとりでも、友達とも。";
const CARD = "/opengraph-image.png";
const CARD_ALT = "つれづれ — 思いつくまま、書き散らす。";

export function card(title: string = SITE, url?: string) {
  return {
    type: "website" as const,
    siteName: SITE,
    locale: "ja_JP",
    title,
    description: ABOUT,
    ...(url ? { url } : {}),
    images: [{ url: CARD, width: 1200, height: 630, alt: CARD_ALT }],
  };
}
