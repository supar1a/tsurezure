import { kanjiNumber } from "./kanji";

/*
 * 箇条書き・番号・チェック・線。
 *
 * 書く欄はただの textarea なので、打った字がそのまま見える。だから「打った印を、
 * そのまま読める字に置き換える」ことで、書きながら仕上がりが見えるようにする。
 * 記法を隠し持たない——本文に入っているのは、読むときに見える字そのもの。
 *
 *   - ＋空白      → ・        （箇条書き）
 *   1. ＋空白     → 一、      （番号。漢数字。次の行は二、三、…）
 *   [ ] ＋空白    → ☐        （チェック。[x] なら ☑）
 *   ---           → そのまま  （線。読むときに罫になる）
 *
 * 太字や見出しは持たない。書き散らしに要るのはこのくらい。
 */

export const BULLET = "・";
export const BOX = "☐";
export const CHECKED = "☑";

const KANJI = "[〇一二三四五六七八九十百]+";
/** 行頭の印。番号は「一、」のように読点で切る。 */
const MARK_RE = new RegExp(`^(${BULLET}|${BOX} ?|${CHECKED} ?|${KANJI}、)`);
const NUMBER_RE = new RegExp(`^(${KANJI})、`);

export type Mark =
  | { kind: "bullet" }
  | { kind: "check"; done: boolean }
  | { kind: "number"; n: number };

const DIGITS: Record<string, number> = { 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** 「二十三」→ 23。百までで足りる。 */
export function readKanjiNumber(s: string): number {
  let total = 0, cur = 0;
  for (const ch of s) {
    if (ch === "十") { total += (cur || 1) * 10; cur = 0; }
    else if (ch === "百") { total += (cur || 1) * 100; cur = 0; }
    else cur = DIGITS[ch] ?? 0;
  }
  return total + cur;
}

/** 行の頭に印があれば、その種類と、印を除いた本文。 */
export function markOf(line: string): { mark: Mark; rest: string } | null {
  const m = MARK_RE.exec(line);
  if (!m) return null;
  const head = m[1];
  const rest = line.slice(head.length);
  if (head === BULLET) return { mark: { kind: "bullet" }, rest };
  if (head.startsWith(BOX)) return { mark: { kind: "check", done: false }, rest };
  if (head.startsWith(CHECKED)) return { mark: { kind: "check", done: true }, rest };
  const n = NUMBER_RE.exec(head);
  if (n) return { mark: { kind: "number", n: readKanjiNumber(n[1]) }, rest };
  return null;
}

/** 印を字にしたもの。読むときも書くときも、これがそのまま行頭に立つ。 */
export function glyphOf(mark: Mark): string {
  if (mark.kind === "bullet") return BULLET;
  if (mark.kind === "check") return (mark.done ? CHECKED : BOX) + " ";
  return kanjiNumber(mark.n) + "、";
}

/* 打った印。行頭で、この形になった瞬間に置き換える。 */
const TYPED: [RegExp, (m: RegExpExecArray) => string][] = [
  // 続きで立てた ☐ のあとに [x] と打ったら、済みにする（逆も）
  [/^☐ \[[xX✓✔]\][ 　]$/, () => CHECKED + " "],
  [/^☑ \[[ 　]?\][ 　]$/, () => BOX + " "],
  [/^\[[xX✓✔]\][ 　]$/, () => CHECKED + " "],
  [/^\[[ 　]?\][ 　]$/, () => BOX + " "],
  [/^-[ 　]\[[xX✓✔]\][ 　]$/, () => CHECKED + " "],
  [/^-[ 　]\[[ 　]?\][ 　]$/, () => BOX + " "],
  [/^[-*・][ 　]$/, () => BULLET],
  [/^([0-9０-９]+)[.．、][ 　]?$/, (m) => kanjiNumber(Number(m[1].replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10)))) + "、"],
];

type Edit = { value: string; caret: number };

/** 挿入位置の行の、始まりと終わり。 */
function lineAt(value: string, caret: number) {
  const start = value.lastIndexOf("\n", caret - 1) + 1;
  const endAt = value.indexOf("\n", caret);
  const end = endAt === -1 ? value.length : endAt;
  return { start, end, line: value.slice(start, end) };
}

/**
 * 打ったばかりの印を、読める字に置き換える。
 * 行頭から挿入位置までが「- 」などの形になっていたら。置き換えるものが無ければ null。
 */
export function autoMark(value: string, caret: number): Edit | null {
  const { start } = lineAt(value, caret);
  const typed = value.slice(start, caret);
  for (const [re, to] of TYPED) {
    const m = re.exec(typed);
    if (!m) continue;
    const glyph = to(m);
    return { value: value.slice(0, start) + glyph + value.slice(caret), caret: start + glyph.length };
  }
  return null;
}

/**
 * Enter を押したとき、印のある行なら次の行にも印を立てる。
 * 印だけで中身の無い行で Enter なら、印を消して箇条書きを終える。
 * 印の無い行なら null（ふつうの改行に任せる）。
 */
export function continueMark(value: string, caret: number): Edit | null {
  const { start, end, line } = lineAt(value, caret);
  // 行の途中で Enter なら、ふつうの改行に任せる（印は続けない）
  if (caret < end) return null;
  const found = markOf(line);
  if (!found) return null;

  if (found.rest.trim() === "") {
    // 空の項目で Enter：印を消して終わり
    return { value: value.slice(0, start) + value.slice(end), caret: start };
  }
  const next =
    found.mark.kind === "number"
      ? glyphOf({ kind: "number", n: found.mark.n + 1 })
      : found.mark.kind === "check"
        ? glyphOf({ kind: "check", done: false })
        : BULLET;
  const inserted = "\n" + next;
  return { value: value.slice(0, caret) + inserted + value.slice(caret), caret: caret + inserted.length };
}

/** 本文の n 行目（生の行番号）のチェックを反転する。チェックの行でなければそのまま。 */
export function toggleCheck(body: string, lineIndex: number): string {
  const lines = body.split("\n");
  const line = lines[lineIndex];
  if (line === undefined) return body;
  const trimmed = line.trimStart();
  const lead = line.slice(0, line.length - trimmed.length);
  if (trimmed.startsWith(BOX)) lines[lineIndex] = lead + CHECKED + trimmed.slice(BOX.length);
  else if (trimmed.startsWith(CHECKED)) lines[lineIndex] = lead + BOX + trimmed.slice(CHECKED.length);
  else return body;
  return lines.join("\n");
}
