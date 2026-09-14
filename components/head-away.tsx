"use client";

import { useEffect } from "react";

/** これだけ同じ向きに動いたら、向きが変わったとみなす。細かい揺れでは動かさない。 */
const TURN = 12;

/**
 * 読み進めているあいだ、柱は引っ込む。横書きの頁で、下へ送ると（指を上へ動かすと）
 * 頭の帯が消えるのと同じ。
 *
 * 巻物は左端（いちばん新しいところ）でひらく。読み進めるとは、右にある古いほうへ
 * 進むこと——指を左へ動かすこと。だから指を左へ動かせば柱は右の端から滑って出ていき、
 * 指を右へ動かせば（戻れば）右からにゅっと滑って戻る。
 *
 * 動かすのは見た目だけで、場所は空けたままにしてある。
 * 柱を畳むと巻きの幅が変わり、縦組みでは一列に入る字数が変わるので、
 * 読んでいる最中に本文がまるごと組み直されてしまう。
 *
 * 向きは scrollLeft の符号ではなく、中身の左端の位置で測る。
 * 縦組みの巻きでは scrollLeft の符号が環境で割れるので。
 */
export function HeadAway() {
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".scroll-tate");
    const stream = scroller?.querySelector<HTMLElement>("[data-stream]");
    const app = document.querySelector<HTMLElement>(".app");
    if (!scroller || !stream || !app) return;

    const edge = () => stream.getBoundingClientRect().left;

    // 人が触れるまでは動かさない。ひらいた直後は、こちらが巻きを置きなおすことがあるので。
    let armed = false;
    let last = edge();
    let run = 0; // 同じ向きに動いた量。向きが変われば捨てる。

    /*
     * 触れるたびに基準を取り直す。
     * 送りと送りのあいだに中身が伸び縮みすると（字体や写真が遅れて入る）、scroll が鳴らないまま
     * 端が動く。古い基準のままだと、次の送りの差分がそのぶん食われる。
     */
    const arm = () => {
      armed = true;
      last = edge();
      run = 0;
    };

    // 中身や器の寸法が変わったときも、それは送りではないので基準だけ取り直す
    const rebase = () => {
      last = edge();
    };

    const update = () => {
      if (!armed) return;
      const now = edge();
      const delta = now - last;
      last = now;
      if (delta === 0) return;

      // 右端（いちばん古いところ）で引っぱっただけ（跳ね返り）は、読み進めたうちに入れない
      const view = scroller.getBoundingClientRect();
      const atRightEnd = stream.getBoundingClientRect().right <= view.right + 1;
      if (atRightEnd && delta < 0) return;

      run = Math.sign(run) === Math.sign(delta) ? run + delta : delta;
      if (Math.abs(run) < TURN) return;
      // 中身が左へ動いた（指を左へ動かした＝読み進めた）なら、柱は引っ込む。右へ戻せば出る。
      app.dataset.reading = run < 0 ? "true" : "false";
      run = 0;
    };

    const starts = ["touchstart", "pointerdown"] as const;
    starts.forEach((name) => scroller.addEventListener(name, arm, { passive: true }));
    // 輪や鍵は、触れる合図が無い。触れっぱなしとみなして、最初の一度だけ基準を取る。
    const armOnce = () => { if (!armed) arm(); };
    scroller.addEventListener("wheel", armOnce, { passive: true });
    window.addEventListener("keydown", armOnce, { passive: true });
    scroller.addEventListener("scroll", update, { passive: true });
    const watcher = new ResizeObserver(rebase);
    watcher.observe(stream);
    watcher.observe(scroller);

    return () => {
      starts.forEach((name) => scroller.removeEventListener(name, arm));
      scroller.removeEventListener("wheel", armOnce);
      window.removeEventListener("keydown", armOnce);
      scroller.removeEventListener("scroll", update);
      watcher.disconnect();
      delete app.dataset.reading;
    };
  }, []);

  return null;
}
