// ロゴ（scripts/logo/logo-tsurezure.src.svg）の字を、輪郭に焼く。
//
// もとの SVG は「あじふで」の生の文字なので、見る人の端末にそのフォントが無いと別の字体で出る。
// この Mac に入っているフォントから字形を取り出して path にし、components/logo.tsx に埋める。
//
// 使いかた: npm i --no-save opentype.js && node scripts/outline-logo.mjs
// 要るもの: ~/Library/Fonts/ajihude.ttf（あじふで）
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const buf = readFileSync(path.join(process.env.HOME, "Library/Fonts/ajihude.ttf"));
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

// もとの SVG と同じ置きかた：12px の字を、y = 10.312 から 12 ずつ下へ
const SIZE = 12;
const chars = ["つ", "れ", "づ", "れ"];
let d = "";
const box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
chars.forEach((ch, i) => {
  const p = font.getPath(ch, 0, 10.312 + i * SIZE, SIZE);
  const b = p.getBoundingBox();
  box.x0 = Math.min(box.x0, b.x1); box.x1 = Math.max(box.x1, b.x2);
  box.y0 = Math.min(box.y0, b.y1); box.y1 = Math.max(box.y1, b.y2);
  d += p.toPathData(3) + " ";
});
// 字面ぴったりに切る（余白は CSS で取る）。頭が中身の頭に揃うように。
const pad = 0.1;
const view = [box.x0 - pad, box.y0 - pad, box.x1 - box.x0 + pad * 2, box.y1 - box.y0 + pad * 2].map((n) => n.toFixed(3)).join(" ");

const tsx = `// scripts/outline-logo.mjs が作る。手で直さない。
// ロゴ「つれづれ」。あじふでの字を輪郭に焼いたもの。色は currentColor、大きさは CSS の height で。
export const LOGO_VIEWBOX = "${view}";
export const LOGO_PATH =
  "${d.trim()}";
`;
writeFileSync(path.join(here, "..", "components", "logo-path.ts"), tsx);
writeFileSync(path.join(here, "logo", "logo-tsurezure.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" role="img" aria-label="つれづれ"><path fill="currentColor" d="${d.trim()}"/></svg>\n`);
console.log("viewBox", view, "| path", d.length, "bytes");
