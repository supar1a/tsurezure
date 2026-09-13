"use client";

import { useEffect } from "react";

/** これ以下の揺れは、鍵盤の出入りではないとみなす。 */
const NOISE = 24;

/**
 * 画面の鍵盤（ソフトキーボード）に覆われた高さを、`--keyboard` として伝える。
 *
 * 縦組みではこれが要る。横組みなら、鍵盤が下半分を覆っても打っている行は
 * 上へ送られて見えつづける。縦組みは字が下へ流れるので、打っているところが
 * そのまま鍵盤の裏へ入る。`100dvh` は鍵盤では縮まない（iOS は覆うだけで
 * 版面を変えない）ので、覆われた分をここで測って場の丈から差し引く。
 *
 * ただし、**細かく追ってはいけない。**
 * この値を変えると場の丈が変わり、縦組みは一列に入る字数が変わるので、
 * 本文がまるごと組み直される。visualViewport の scroll は iOS では
 * 指を動かすたびに飛んでくるので、素直に拾うと打っている最中に
 * 版面が何度も組み直されることになる。
 * 鍵盤の出入りだけを見て、それ以外の揺れは捨てる。
 */
export function KeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    let applied = 0;

    const apply = (force = false) => {
      // 覆われた高さ。鍵盤が閉じていれば 0。
      // 位置欄の出入りは innerHeight と vv.height の両方が動くので、ここには出ない。
      const covered = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
      // 出入りと呼べるだけ動いたときだけ、版面に伝える
      if (!force && Math.abs(covered - applied) < NOISE) return;
      applied = covered;
      root.style.setProperty("--keyboard", `${covered}px`);
    };

    apply(true); // はじめの一度は、動いていなくても伝える
    // scroll は拾わない。指を動かすたびに飛んでくるので、組み直しの元になる。
    const onResize = () => apply();
    vv.addEventListener("resize", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      root.style.removeProperty("--keyboard");
    };
  }, []);

  return null;
}
