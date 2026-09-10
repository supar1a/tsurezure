/*
 * 分かち合うときに出る名札。
 *
 * Next.js は openGraph を頁ごとに上書きする。混ぜてはくれないので、
 * 題だけ差し替えたいときも、絵や種別を毎回そろえて渡す必要がある。
 * 取りこぼしが起きないよう、作るのはここ一か所に寄せてある。
 */
export const SITE = "つれづれ";
export const ABOUT = "仲間うちだけの、縦書きの書き散らし。";
const CARD = "/opengraph-image.png";

export function card(title: string = SITE) {
  return {
    type: "website" as const,
    siteName: SITE,
    locale: "ja_JP",
    title,
    description: ABOUT,
    images: [CARD],
  };
}
