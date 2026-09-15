import { LOGO_PATH, LOGO_VIEWBOX } from "./logo-path";

/**
 * ロゴ「つれづれ」。筆の字を輪郭に焼いた SVG（scripts/logo/logo-tsurezure.svg）。
 * 色は currentColor。大きさは、置く側の CSS で height を与える。
 * 読み上げには、置く側が字の「つれづれ」を添える（この絵は飾りとして隠す）。
 */
export function Logo({ className = "logo" }: { className?: string }) {
  return (
    <svg className={className} viewBox={LOGO_VIEWBOX} aria-hidden="true" focusable="false">
      <path fill="currentColor" d={LOGO_PATH} />
    </svg>
  );
}
