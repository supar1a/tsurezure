import { LOGO_PATH, LOGO_VIEWBOX } from "./logo-path";

/**
 * ロゴ「つれづれ」。筆の字を輪郭に焼いた SVG（scripts/logo/logo-tsurezure.svg）。
 * 色は currentColor。大きさは、置く側の CSS で height を与える。
 * 読み上げには、置く側が字の「つれづれ」を添える（この絵は飾りとして隠す）。
 */
export function Logo({ className = "logo" }: { className?: string }) {
  // 幅と丈を属性でも持たせる。viewBox だけだと、Safari は縦組みの中で幅を「空いているだけ全部」と
  // 解いてしまうことがあり、柱が画面いっぱいに広がる（iPhone 14 Plus の実機で起きた）。
  const [, , w, h] = LOGO_VIEWBOX.split(/\s+/).map(Number);
  return (
    <svg className={className} viewBox={LOGO_VIEWBOX} width={w} height={h} aria-hidden="true" focusable="false">
      <path fill="currentColor" d={LOGO_PATH} />
    </svg>
  );
}
