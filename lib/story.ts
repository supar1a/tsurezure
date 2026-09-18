import { paragraphs, splitAroundPhoto } from "./text";
import { glyphOf } from "./marks";

/*
 * 一篇を、縦書きのまま一枚の絵にする（1080×1920、ストーリーの寸法）。
 *
 * ブラウザの canvas には縦組みが無いので、一字ずつ置いていく。
 * 字の扱いは三通り：
 *   ・漢字かな……そのまま立てる
 *   ・句読点・小書きの仮名……升の右上に寄せる
 *   ・長音・括弧・ラテン文字・数字……九十度倒す
 * 字体は画面と同じ「しっぽり明朝」。読み込み済みのものを使う。
 */

export const STORY_W = 1080;
export const STORY_H = 1920;

const FONT = '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", serif';
const PAPER = "#f7f7f5";
const SUMI = "#1e1b16";
const SOFT = "#5f574c";
const FAINT = "#736a5e";

const PUNCT = new Set("、。，．");
const SMALL = new Set("ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ");
const ROTATE = /[ー—―…‥「」『』（）()［］\[\]｛｝{}〈〉《》【】〔〕〜～\-–A-Za-z0-9!?:;'"@#$%&*+=<>\/\\|^_`]/;

/** cells は、その字が升をいくつ占めるか。ラテン文字の連なりは倒して一つにまとめ、字幅ぶんだけ升を取る */
type Glyph = { ch: string; kind: "upright" | "corner" | "rotate"; cells: number };

const LATIN = /[A-Za-z0-9!?:;'"@#$%&*+=<>\/\\|^_`\-.,]/;

function classify(ch: string): Glyph {
  if (PUNCT.has(ch) || SMALL.has(ch)) return { ch, kind: "corner", cells: 1 };
  if (ROTATE.test(ch)) return { ch, kind: "rotate", cells: 1 };
  return { ch, kind: "upright", cells: 1 };
}

/** 一行を字に分ける。ラテン文字が続くところは、一つの倒した塊にする（一字ずつ升に入れると間延びする） */
function glyphsOf(text: string): Glyph[] {
  const out: Glyph[] = [];
  let run = "";
  const flush = () => {
    if (!run) return;
    // ラテン文字はおよそ半角。升の数は字数の 0.56 倍で見る
    out.push({ ch: run, kind: "rotate", cells: Math.max(1, Math.ceil(run.length * 0.56)) });
    run = "";
  };
  for (const ch of text) {
    if (LATIN.test(ch) || (ch === " " && run)) { run += ch; continue; }
    flush();
    out.push(classify(ch));
  }
  flush();
  return out;
}

type Column = { glyphs: Glyph[]; indent: number; size: number; weight: number; color: string };

/**
 * 本文を列に分ける。段落ごとに一字下げ。列の丈に収まらなければ折る。
 * 句読点は列の頭に来ないよう、前の列の末尾にぶら下げる。
 */
function layout(text: string, size: number, perColumn: number, indent: number, weight = 400, color = SUMI): Column[] {
  const cols: Column[] = [];
  for (const line of paragraphs(text)) {
    if (line.rule) {
      cols.push({ glyphs: [], indent: 0, size, weight, color: FAINT });
      continue;
    }
    const head = line.mark ? glyphOf(line.mark) : "";
    const chars = glyphsOf(head + line.text);
    const firstIndent = line.mark ? 0 : indent;
    const hanging = line.mark ? [...head].length : 0;
    let i = 0;
    let first = true;
    if (chars.length === 0) { cols.push({ glyphs: [], indent: 0, size, weight, color }); continue; }
    while (i < chars.length) {
      const ind = first ? firstIndent : hanging;
      const room = perColumn - ind;
      let end = i;
      let used = 0;
      while (end < chars.length && used + chars[end].cells <= room) { used += chars[end].cells; end += 1; }
      if (end === i) end = i + 1; // 一升に収まらない塊でも、一つは置く
      // 次の字が句読点なら、この列の末尾に一字ぶら下げる
      if (end < chars.length && PUNCT.has(chars[end].ch)) end += 1;
      cols.push({ glyphs: chars.slice(i, end), indent: ind, size, weight, color });
      i = end;
      first = false;
    }
  }
  return cols;
}

function drawGlyph(ctx: CanvasRenderingContext2D, g: Glyph, x: number, y: number, size: number, pitch = size) {
  // (x, y) は升の中心
  if (g.kind === "rotate") {
    ctx.save();
    if (g.cells > 1) {
      // 塊は、最初の升の上端から下へ流す
      ctx.translate(x, y - pitch / 2);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = "left";
      ctx.fillText(g.ch, 0, 0);
    } else {
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(g.ch, 0, 0);
    }
    ctx.restore();
    return;
  }
  if (g.kind === "corner") {
    ctx.fillText(g.ch, x + size * 0.28, y - size * 0.28);
    return;
  }
  ctx.fillText(g.ch, x, y);
}

async function grain(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/paper-grain.png";
  });
}

export type StorySource = {
  title: string | null;
  body: string;
  /** 「二〇二六年九月十八日」のように、すでに字にしたもの */
  date: string;
};

/** 一篇を絵にして canvas に描く。共有や保存に使うのは PNG の Blob。 */
export async function renderStory(slip: StorySource): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("描けませんでした");

  // 字体を確かめてから描く（読めていないと代替の字体で描かれる）
  await Promise.all([
    document.fonts.load(`400 40px ${FONT}`),
    document.fonts.load(`600 40px ${FONT}`),
  ]).catch(() => {});

  // 紙
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  const tile = await grain();
  if (tile) {
    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      ctx.save();
      ctx.scale(0.5, 0.5); // 2 倍密度で焼いてあるので、等倍の粒に戻す
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, STORY_W * 2, STORY_H * 2);
      ctx.restore();
    }
  }

  const margin = { top: 200, right: 120, bottom: 200, left: 120 };
  const small = 26; // 日付と印の字
  const usable = STORY_H - margin.top - margin.bottom;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let x = STORY_W - margin.right; // 右端（ここから左へ列を置く）

  // 題
  const { before, after } = splitAroundPhoto(slip.body);
  const text = [before, after].filter(Boolean).join("\n\n");
  if (slip.title) {
    const titleSize = 56;
    const cols = layout(slip.title, titleSize, Math.floor(usable / (titleSize * 1.24)), 0, 600);
    x -= titleSize / 2;
    for (const col of cols) {
      ctx.font = `600 ${titleSize}px ${FONT}`;
      ctx.fillStyle = SUMI;
      let y = margin.top + titleSize / 2;
      for (const g of col.glyphs) { drawGlyph(ctx, g, x, y, titleSize, titleSize * 1.24); y += titleSize * 1.24 * g.cells; }
      x -= titleSize * 1.9;
    }
    x += titleSize * 1.9 - titleSize / 2; // 最後の列の左端に戻す
    x -= titleSize * 1.1; // 題と本文のあいだ
  }

  // 本文。左端は日付の列の右。収まらなければ字を小さくして、それでも余れば「…」で断る
  const leftLimit = margin.left + small * 2.2;
  let chosen: { size: number; cols: Column[]; gap: number; pitch: number } | null = null;
  for (const size of [40, 36, 32, 28]) {
    const pitch = size * 1.18;
    const gap = size * 2.2;
    const cols = layout(text, size, Math.floor(usable / pitch), 1);
    const need = cols.length * gap;
    chosen = { size, cols, gap, pitch };
    if (x - need >= leftLimit) break;
  }
  const { size: bodySize, cols, gap: columnGap, pitch } = chosen!;
  const maxColumns = Math.max(1, Math.floor((x - leftLimit) / columnGap));
  const shown = cols.slice(0, maxColumns);
  x -= bodySize / 2;
  for (const col of shown) {
    if (col.glyphs.length === 0 && col.color === FAINT) {
      // 罫
      ctx.strokeStyle = "rgba(33, 30, 25, 0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, margin.top + usable * 0.12);
      ctx.lineTo(x, margin.top + usable * 0.88);
      ctx.stroke();
      x -= columnGap;
      continue;
    }
    ctx.font = `${col.weight} ${col.size}px ${FONT}`;
    ctx.fillStyle = col.color;
    let y = margin.top + bodySize / 2 + col.indent * pitch;
    for (const g of col.glyphs) { drawGlyph(ctx, g, x, y, bodySize, pitch); y += pitch * g.cells; }
    x -= columnGap;
  }
  if (shown.length < cols.length) {
    // 収まらなかった分は「…」で断る
    ctx.font = `400 ${bodySize}px ${FONT}`;
    ctx.fillStyle = FAINT;
    drawGlyph(ctx, { ch: "…", kind: "rotate", cells: 1 }, x, margin.top + bodySize / 2, bodySize);
  }

  // 日付（左下）と、つれづれの印
  ctx.font = `400 ${small}px ${FONT}`;
  ctx.fillStyle = SOFT;
  const dateGlyphs = glyphsOf(slip.date);
  let dy = STORY_H - margin.bottom - dateGlyphs.length * small * 1.2;
  const dx = margin.left + small / 2;
  for (const g of dateGlyphs) { drawGlyph(ctx, g, dx, dy, small); dy += small * 1.2; }

  ctx.font = `400 ${small}px ${FONT}`;
  ctx.fillStyle = FAINT;
  const mark = glyphsOf("つれづれ");
  let my = margin.top + small / 2;
  for (const g of mark) { drawGlyph(ctx, g, dx, my, small); my += small * 1.3; }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("書き出せませんでした"))), "image/png");
  });
}
