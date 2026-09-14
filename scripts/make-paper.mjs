// 紙の地（粒と斑）を PNG に焼く。 node scripts/make-paper.mjs → public/paper-grain.png, public/paper-mottle.png
//
// もとは SVG の feTurbulence を背景にして multiply で掛け合わせていたが、Safari では
// 混色（blend）が入ると巻きを送るたびに地を描き直すので重い。
// 地の色が一色なので、multiply は「黒を透かして重ねる」のと同じ結果になる：
//   base × (1 − op × (1 − gray)) ＝ base の上に、黒を alpha = op × (1 − gray) で置く
// だから黒＋alpha の PNG を焼いておけば、混色なしで同じ見た目になる。
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "public");

// 決まった種から同じ乱数列を出す（開くたびに違う紙にならないように）
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t) => t * t * (3 - 2 * t);

/** 継ぎ目なく繋がる value noise。cells は一辺の格子の数。 */
function valueNoise(size, cells, random) {
  const lattice = new Float32Array(cells * cells);
  for (let i = 0; i < lattice.length; i++) lattice[i] = random();
  const at = (x, y) => lattice[((y + cells) % cells) * cells + ((x + cells) % cells)];
  const field = new Float32Array(size * size);
  const step = size / cells;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = x / step, gy = y / step;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const tx = smooth(gx - x0), ty = smooth(gy - y0);
      const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
      field[y * size + x] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
  }
  return field;
}

/** feTurbulence の fractalNoise に寄せる：周波数を倍にしながら振幅を半分にして重ねる。 */
function fractal(size, baseCells, octaves, seed) {
  const random = rng(seed);
  const sum = new Float32Array(size * size);
  let amp = 1, total = 0, cells = baseCells;
  for (let o = 0; o < octaves; o++) {
    const f = valueNoise(size, Math.min(cells, size), random);
    for (let i = 0; i < sum.length; i++) sum[i] += (f[i] - 0.5) * amp;
    total += amp;
    amp /= 2;
    cells *= 2;
  }
  // 0.5 を中心に、だいたい 0〜1 に収める
  for (let i = 0; i < sum.length; i++) sum[i] = Math.min(1, Math.max(0, 0.5 + sum[i] / total));
  return sum;
}

// ── PNG（gray + alpha, 8bit） ──
const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c;
}
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function png(size, alphaOf) {
  const raw = Buffer.alloc((size * 2 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 2 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const o = y * (size * 2 + 1) + 1 + x * 2;
      raw[o] = 0; // 黒
      raw[o + 1] = alphaOf(x, y);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 4; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8bit, gray+alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// 濃さは、もとの SVG を撮った画面と数で合わせた（紙の空き地の明るさの平均と散らばり）。
// SVG の乱流は透明度もノイズなので、opacity の数字よりずっと淡く出ていた。
// 平均の濃さと、粒の立ちかた（散らばり）を別々に決める：alpha = 平均 + 幅 × (0.5 − noise)
const GRAIN = { mean: 0.04, spread: 0.09 };
const MOTTLE = { mean: 0.0175, spread: 0.05 };
const alpha = ({ mean, spread }, n) => Math.round(255 * Math.min(1, Math.max(0, mean + spread * (0.5 - n))));

// 画素の粗さ。CSS では半分の大きさで敷く（--paper-size）ので、2 倍の密度で焼く。
// 1 倍で焼くと、携帯（2〜3 倍）では粒が 2〜3 画素の塊になって、紙でなく砂利に見える。
const SCALE = 2;
// 透明度は 2 段ごとに丸める（幅が 0〜35 ほどなので、それでも 18 段ある）。ノイズは縮まないので、段を減らして PNG を軽くする。
const quantize = (a) => Math.round(a / 2) * 2;

// 粒：細かく、四層。もとは baseFrequency 0.85・numOctaves 4（260px の繰り返し）。CSS では 192px。
{
  const size = 192 * SCALE;
  const noise = fractal(size, 96 * SCALE, 4, 1741);
  const buf = png(size, (x, y) => quantize(alpha(GRAIN, noise[y * size + x])));
  writeFileSync(path.join(out, "paper-grain.png"), buf);
  console.log("paper-grain.png", buf.length, "bytes");
}
// 斑：大きく、二層。もとは baseFrequency 0.045・numOctaves 2（600px の繰り返し）。CSS では 384px。
{
  const size = 384 * SCALE;
  const noise = fractal(size, 16, 2, 6023);
  const buf = png(size, (x, y) => quantize(alpha(MOTTLE, noise[y * size + x])));
  writeFileSync(path.join(out, "paper-mottle.png"), buf);
  console.log("paper-mottle.png", buf.length, "bytes");
}
