"use client";

import { useEffect } from "react";

/** これだけ同じ向きに指が動いたら、向きが変わったとみなす。細かい揺れでは動かさない。 */
const TURN = 12;

/**
 * 指を右へ動かすと柱は右の端から滑って出ていき、指を左へ動かすと右からにゅっと戻る。
 *
 * 向きは、巻きの位置ではなく**指そのものの動き**で決める。
 * 縦組みの巻きは scrollLeft の符号も並びも環境で割れるが、指が右へ動いたか左へ動いたかは
 * どのブラウザでも一つしかない。輪（トラックパッド）は deltaX の向きで同じことをする。
 *
 * 動かすのは見た目だけで、場所は空けたままにしてある。
 * 柱を畳むと巻きの幅が変わり、縦組みでは一列に入る字数が変わるので、
 * 読んでいる最中に本文がまるごと組み直されてしまう。
 */
export function HeadAway() {
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".scroll-tate");
    const stream = scroller?.querySelector<HTMLElement>("[data-stream]");
    const app = document.querySelector<HTMLElement>(".app");
    if (!scroller || !stream || !app) return;

    let run = 0; // 同じ向きに動いた量。向きが変われば捨てる。
    let lastX: number | null = null;

    // 左端（いちばん新しいところ）でさらに右へ引っぱっても、もう見るものは無い。柱は動かさない。
    const atLeftEnd = () =>
      stream.getBoundingClientRect().left >= scroller.getBoundingClientRect().left - 1;

    /** 指（や輪）が dx だけ横に動いた。正なら右へ。 */
    const moved = (dx: number) => {
      if (dx === 0) return;
      if (dx > 0 && atLeftEnd()) return;
      run = Math.sign(run) === Math.sign(dx) ? run + dx : dx;
      if (Math.abs(run) < TURN) return;
      app.dataset.reading = run > 0 ? "true" : "false";
      run = 0;
    };

    const onTouchStart = (event: TouchEvent) => {
      lastX = event.touches[0]?.clientX ?? null;
      run = 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      const x = event.touches[0]?.clientX;
      if (x === undefined || lastX === null) return;
      moved(x - lastX);
      lastX = x;
    };
    const onTouchEnd = () => {
      lastX = null;
    };
    // 輪：中身が右へ流れる（deltaX が負）のは、指を右へ動かしたのと同じ
    const onWheel = (event: WheelEvent) => {
      const dx = event.deltaX !== 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0;
      moved(-dx);
    };

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: true });
    scroller.addEventListener("touchend", onTouchEnd, { passive: true });
    scroller.addEventListener("touchcancel", onTouchEnd, { passive: true });
    scroller.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchEnd);
      scroller.removeEventListener("wheel", onWheel);
      delete app.dataset.reading;
    };
  }, []);

  return null;
}
