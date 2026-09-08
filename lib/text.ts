/** 一覧に出す抜粋。改行は「一字あけ」に潰して縦の列を整える。 */
export function excerpt(body: string, max = 110) {
  const flat = body.replace(/\s*\n+\s*/g, "　").trim();
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

/** 本文の段落分け（空行区切り） */
export function paragraphs(body: string) {
  return body
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, "\n").trim())
    .filter(Boolean);
}

/**
 * 題の長さの上限。
 *
 * 目次では一篇が一行になるので、題が長いと行が伸びて一覧の体をなさなくなる。
 * 打ち込みの上限（maxLength）と、送られてきたものの検めと、
 * 書く人に見せる残り字数——三つが食い違わないよう、ここ一か所から取る。
 */
export const TITLE_MAX = 40;

export function countChars(body: string) {
  return [...body.replace(/\s/g, "")].length;
}

/**
 * 写真を置く場所の印。
 *
 * 本文のただの文字として持つ。そうすれば、書いたあとで位置を動かすのも
 * 切り貼りでできるし、書きかけの見た目のまま扱える。
 */
export const PHOTO_MARK = "［写真］";
const PHOTO_MARK_RE = /［写真］|\[写真\]/;
const PHOTO_MARK_ANY = /［写真］|\[写真\]/g;

export function hasPhotoMark(body: string) {
  return PHOTO_MARK_RE.test(body);
}

/**
 * 印のあるところで本文を二つに割る。
 * 印が無ければ、写真は本文より前に置く（印を持たない古い投稿のため）。
 */
export function splitAroundPhoto(body: string) {
  const found = PHOTO_MARK_RE.exec(body);
  if (!found) return { before: "", after: body };

  const strip = (text: string) => text.replace(new RegExp(PHOTO_MARK_RE, "g"), "");
  return {
    before: strip(body.slice(0, found.index)).trimEnd(),
    after: strip(body.slice(found.index + found[0].length)).trimStart(),
  };
}

/** 前・写真・後ろ を、一本の本文に戻す。 */
export function composeBody(before: string, after: string, withPhoto: boolean) {
  const parts = withPhoto ? [before, PHOTO_MARK, after] : [before, after];
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * 目次に出す見出し。
 * 題を付けていなければ、本文の一行目を借りる。書き散らしに題を強いないため。
 */
export function headingOf(slip: { title: string | null; body: string }, max = 44) {
  const named = slip.title?.trim();
  if (named) return named;

  const first = slip.body
    .split("\n")
    .map((line) => line.replace(PHOTO_MARK_ANY, "").trim())
    .find(Boolean);
  if (!first) return "（写真だけ）";

  // 題の代わりなので、読みはじめが分かるところまでは見せる。
  // 一文で切れるならそこで切り、長すぎれば落とす。
  const stop = first.indexOf("。");
  const sentence = stop >= 0 && stop + 1 <= max ? first.slice(0, stop + 1) : first;
  return sentence.length > max ? sentence.slice(0, max) + "…" : sentence;
}
