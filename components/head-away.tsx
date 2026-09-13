"use client";

import { useEffect } from "react";

/** これ以上ひらいたら、読み進めているとみなす。 */
const AWAY = 80;

/**
 * 読み進めているあいだ、柱を引っ込める。
 *
 * 長い文章を送っているときに、表題や品書きがずっと横にあると邪魔になる。
 * 手を動かして、ひらいたところから離れたら消える。戻れば また出る。
 *
 * 消すのは濃さだけで、場所は空けたままにしてある。
 * 柱を畳むと巻きの幅が変わり、縦組みでは一列に入る字数が変わるので、
 * 読んでいる最中に本文がまるごと組み直されてしまう。
 */
export function HeadAway() {
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".scroll-tate");
    const app = document.querySelector<HTMLElement>(".app");
    if (!scroller || !app) return;

    // 人が動かしはじめたところ。ここからどれだけ離れたかで決める。
    // 開いた位置そのものは、こちらが後から寄せなおすことがあるので当てにしない。
    let home: number | null = null;

    const mark = () => {
      if (home === null) home = scroller.scrollLeft;
    };

    const update = () => {
      if (home === null) return;
      app.dataset.reading = Math.abs(scroller.scrollLeft - home) > AWAY ? "true" : "false";
    };

    const starts = ["wheel", "touchstart", "pointerdown"] as const;
    starts.forEach((name) => scroller.addEventListener(name, mark, { passive: true }));
    scroller.addEventListener("scroll", update, { passive: true });

    return () => {
      starts.forEach((name) => scroller.removeEventListener(name, mark));
      scroller.removeEventListener("scroll", update);
      delete app.dataset.reading;
    };
  }, []);

  return null;
}
