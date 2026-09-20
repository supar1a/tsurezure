/*
 * 書きかけの控え。
 *
 * 一つだけ持つ。新しく書くときだけで、書き直し（編集）では持たない——
 * 編集には元の一篇があるので、控えと二つあると、どちらが本当か分からなくなる。
 *
 * 置き場はこのブラウザの中（localStorage）。サーバーには送らない。
 * 書いた場所（/write か /三人のところ/write か）も一緒に覚えておき、
 * 同じ場所に戻ってきたときだけ差し出す。
 */

const KEY = "tsurezure.draft";
/** 古い控えは差し出さない。七日。 */
const KEEP = 7 * 24 * 60 * 60 * 1000;

export type Draft = { path: string; title: string; before: string; after: string; at: number };

export function readDraft(path: string): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (d.path !== path) return null;
    if (!d.at || Date.now() - d.at > KEEP) return null;
    if (!(d.title || d.before || d.after)) return null;
    return d;
  } catch {
    return null;
  }
}

export function writeDraft(d: Omit<Draft, "at">) {
  try {
    if (!(d.title || d.before || d.after)) return clearDraft();
    localStorage.setItem(KEY, JSON.stringify({ ...d, at: Date.now() }));
  } catch {
    // 置き場がいっぱい、または断られている。控えを持てないだけなので、書くことは止めない
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 同上
  }
}
