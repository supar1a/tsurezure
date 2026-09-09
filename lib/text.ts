/** 一覧に出す抜粋。改行は「一字あけ」に潰して縦の列を整える。 */
export function excerpt(body: string, max = 110) {
  const flat = body.replace(/\s*\n+\s*/g, "　").trim();
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

/*
 * 本文を行に分ける。
 *
 * 改行のたびに一行として扱い、そのそれぞれに一字下げが付く。
 * 縦組みの日本語では、行頭を一字下げるのが段落の目印で、
 * 段落と段落のあいだに空きは作らない。
 *
 * ただし空行を続けて置いた人は、そこで一区切り置いたつもりのはず。
 * 空行そのものは落としつつ、「前に空きがあった」ことだけを覚えておいて、
 * あとで少しだけ間を足す。丸ごと一行空けると流れが切れすぎる。
 */
export type Line = { text: string; afterBlank: boolean };

export function paragraphs(body: string): Line[] {
  const out: Line[] = [];
  let blank = false;
  for (const raw of body.split("\n")) {
    const text = raw.trim();
    if (!text) {
      // 先頭の空行は、間の取りようがないので数えない
      if (out.length > 0) blank = true;
      continue;
    }
    out.push({ text, afterBlank: blank });
    blank = false;
  }
  return out;
}

/*
 * 本文のなかの URL を、そのまま戸口にする。
 *
 * 書いた人が打った文字をこちらで書き換えることはしない。見えかたが変わるだけ。
 * 末尾に句読点や閉じ括弧が付いていたら、それは URL の一部ではないので外す。
 */
const URL_RE = /https?:\/\/[^\s]+/g;
const TRAILING = /[、。，．,.!?！？)）\]］}｝」』】〉》"'']+$/;

export type Piece = { link: boolean; value: string };

export function linkify(text: string): Piece[] {
  const out: Piece[] = [];
  let at = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    let url = m[0];
    const cut = url.match(TRAILING);
    if (cut) url = url.slice(0, url.length - cut[0].length);
    if (!url) continue;
    if (start > at) out.push({ link: false, value: text.slice(at, start) });
    out.push({ link: true, value: url });
    at = start + url.length;
  }
  if (at < text.length) out.push({ link: false, value: text.slice(at) });
  return out;
}

/**
 * 題の長さの上限。
 *
 * 目次では一篇が一行になるので、題が長いと行が伸びて一覧の体をなさなくなる。
 * 打ち込みの上限（maxLength）と、送られてきたものの検めと、
 * 書く人に見せる残り字数——三つが食い違わないよう、ここ一か所から取る。
 */
export const TITLE_MAX = 40;

/** グループの名前の長さの上限。作るときと変えるときで、同じ数を見る。 */
export const PLACE_NAME_MAX = 32;

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
