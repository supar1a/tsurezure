"use client";

import { useEffect } from "react";

/**
 * 画面の鍵盤（ソフトキーボード）に覆われた高さを、`--keyboard` として伝える。
 *
 * 縦組みではこれが致命的になる。横組みなら、鍵盤が下半分を覆っても
 * 打っている行は上へ送られて見えつづける。縦組みは字が下へ流れるので、
 * 打っているところがそのまま鍵盤の裏へ入り、消しても何も変わらなく見える。
 *
 * `100dvh` は鍵盤では縮まない（iOS は覆うだけで版面を変えない）ので、
 * 覆われた分をここで測って、場の丈から差し引く。
 */
export function KeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const apply = () => {
      // 覆われた高さ。鍵盤が閉じていれば 0。
      // 位置欄の出入りは innerHeight と vv.height の両方が動くので、ここには出ない。
      const covered = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
      root.style.setProperty("--keyboard", `${covered}px`);
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      root.style.removeProperty("--keyboard");
    };
  }, []);

  return null;
}
