"use client";

import { useEffect } from "react";

/** これだけ同じ向きに動いたら、向きが変わったとみなす。細かい揺れでは動かさない。 */
const TURN = 12;

/**
 * 柱は、送った向きへ滑る。
 *
 * 柱は右の端に立っている。右へ送れば（左にある中身を見にいけば）柱は右へ滑って画面の外に出る。
 * 左へ送れば（右にある中身へ戻れば）右から滑って戻ってくる。
 * 中身と一緒に動くので、手の動きと柱の動きが食い違わない。
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

      // 端で引っぱっただけ（跳ね返り）は、送ったうちに入れない
      const view = scroller.getBoundingClientRect();
      const atLeftEnd = now >= view.left - 1;
      if (atLeftEnd && delta > 0) return;

      run = Math.sign(run) === Math.sign(delta) ? run + delta : delta;
      if (Math.abs(run) < TURN) return;
      // 中身が右へ動いた（右へ送った）なら、柱も右へ出ていく
      app.dataset.reading = run > 0 ? "true" : "false";
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
