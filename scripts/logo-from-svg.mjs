// ロゴ（scripts/logo/logo-tsurezure.svg、輪郭に焼いた SVG）から、path と viewBox を
// components/logo-path.ts に写す。ロゴを差し替えたら `node scripts/logo-from-svg.mjs`。
//
// 使うのは path の d と viewBox だけ。色は捨てて currentColor にする（置く側の色で染まるように）。
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(path.join(here, "logo", "logo-tsurezure.svg"), "utf8");

if (/<text\b/.test(svg)) throw new Error("ロゴに生の文字（<text>）が残っている。アウトラインを作成してから書き出すこと。");
const view = svg.match(/viewBox="([^"]+)"/)?.[1];
const ds = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
if (!view || ds.length === 0) throw new Error("viewBox か path が見つからない");

const tsx = `// scripts/logo-from-svg.mjs が scripts/logo/logo-tsurezure.svg から作る。手で直さない。
// ロゴ「つれづれ」。色は currentColor、大きさは CSS の height で。
export const LOGO_VIEWBOX = "${view}";
export const LOGO_PATH =
  "${ds.join(" ")}";
`;
writeFileSync(path.join(here, "..", "components", "logo-path.ts"), tsx);
console.log("viewBox", view, "| path", ds.length, "本", ds.join(" ").length, "bytes");
