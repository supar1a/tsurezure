"use client";

import { useEffect } from "react";

/** これだけ同じ向きに巻きが動いたら、向きが変わったとみなす。細かい揺れでは動かさない。 */
const TURN = 12;

/**
 * 指を右へ動かす（中身が右へ流れ、左にあるものが見えてくる）と、柱は右の端から滑って出ていき、
 * 場所ごと畳まれて中身が広がる。指を左へ動かす（中身が左へ流れる）と、右からにゅっと戻る。
 *
 * 向きは、巻きの位置（scrollLeft）の増減で決める。
 * 器は横組みなので、位置はどのブラウザでも左端が 0 で、中身が左へ流れれば増える。
 * 指そのものの動き（touchmove）は、iOS では送りが始まると届かなくなることがあり、
 * 慣性で流れているあいだも拾えない。位置の変化なら、どちらも拾える。
 *
 * ただし人が触れる前は動かさない。ひらいた直後は、こちらが巻きを置きなおすことがあるので。
 * 端で引っぱっただけ（跳ね返り）も、送ったうちに入れない。
 *
 * 柱を畳んでも本文は組み直されない。縦組みでは一列の長さは丈で決まり、幅は
 * 何列見えるかにしか効かない。畳んだぶんは右側に、まだ読んでいない列として現れる。
 */
export function HeadAway() {
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".scroll-tate");
    const app = document.querySelector<HTMLElement>(".app");
    const masthead = app?.querySelector<HTMLElement>(".masthead");
    if (!scroller || !app || !masthead) return;

    // 畳むときに引っ込める幅。柱の実寸を測って CSS に渡す。
    // 巻きの動ける幅も、ここで控えておく（scroll のたびに測ると、そのたびに組みを強いる）。
    let room = scroller.scrollWidth - scroller.clientWidth;
    const measure = () => {
      app.style.setProperty("--masthead-w", `${masthead.offsetWidth}px`);
      room = scroller.scrollWidth - scroller.clientWidth;
    };
    measure();
    const sizer = new ResizeObserver(measure);
    sizer.observe(masthead);
    sizer.observe(scroller);
    const stream = scroller.querySelector<HTMLElement>("[data-stream]");
    if (stream) sizer.observe(stream);

    let armed = false;
    let last = scroller.scrollLeft;
    let run = 0; // 同じ向きに動いた量。向きが変われば捨てる。

    const arm = () => {
      if (armed) return;
      armed = true;
      last = scroller.scrollLeft;
      run = 0;
    };

    const onScroll = () => {
      const now = scroller.scrollLeft;
      const delta = now - last;
      last = now;
      if (!armed || delta === 0) return;
      // 端を越えて引っぱっているあいだ（跳ね返り）は、送ったうちに入れない
      if (now < 0 || now > room) return;

      run = Math.sign(run) === Math.sign(delta) ? run + delta : delta;
      if (Math.abs(run) < TURN) return;
      // 位置が減った＝中身が右へ流れた＝指を右へ動かした。柱は出ていく。
      app.dataset.reading = run < 0 ? "true" : "false";
      run = 0;
    };

    const starts = ["touchstart", "pointerdown", "wheel"] as const;
    starts.forEach((name) => scroller.addEventListener(name, arm, { passive: true }));
    window.addEventListener("keydown", arm, { passive: true });
    scroller.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      sizer.disconnect();
      starts.forEach((name) => scroller.removeEventListener(name, arm));
      window.removeEventListener("keydown", arm);
      scroller.removeEventListener("scroll", onScroll);
      delete app.dataset.reading;
      app.style.removeProperty("--masthead-w");
    };
  }, []);

  return null;
}
