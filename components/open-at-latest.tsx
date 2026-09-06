"use client";

import { useEffect } from "react";

/** 巻きを置きなおすのをやめる時刻（開いてから何ミリ秒か）。 */
const WATCH_FOR = 8000;
/** 左端に置いたとき、端から空けておく幅。 */
const MARGIN = 24;

/**
 * ひらいたら、いつも左端（いちばん新しいところ）に立つ。
 *
 * スマホでもPCでも、開く場所がいつも同じであってほしいので、
 * 読みかけの位置ではなく、常にここに合わせる。
 *
 * 縦組みの巻きでは scrollLeft の符号が環境で割れるので、位置を測って差分で動かす。
 *
 * 置いたあとに、こちらの与り知らぬところで巻きが戻されることがある
 * （字体や写真が遅れて入る、再描画で中身が入れ替わる、焦点が右端の見出しへ移る、など。
 * 端末や回線によって起きたり起きなかったりする）。
 * 一度きり置いて終わりにせず、しばらくは戻されたら置きなおす。
 *
 * ただし、**人が自分で送ったときだけは、二度と触らない。**
 * 読んでいる最中に巻きが引き戻されるのは、右端で開くよりずっと悪い。
 * 指が触れただけでは引かず、触れたうえで実際に送られたときに手を引く。
 */
export function OpenAtLatest({ scrollerId }: { scrollerId: string }) {
  useEffect(() => {
    const scroller = document.getElementById(scrollerId);
    if (!scroller) return;

    // 人に渡した。もうこちらからは動かさない。
    let handedOver = false;
    // こちらが最後に置いた位置。ここから離れていたら、誰かが動かしたということ。
    let mine = scroller.scrollLeft;
    // 指や輪が触れている最中。この間の動きは、人が送ったものとみなす。
    let reaching = false;
    let releaseTimer = 0;

    const align = () => {
      if (handedOver) return;
      const last = scroller.querySelector<HTMLElement>("[data-stream] > :last-child");
      if (!last) return;
      const view = scroller.getBoundingClientRect();
      const box = last.getBoundingClientRect();
      const shift = box.left - (view.left + MARGIN);
      if (Math.abs(shift) >= 1) scroller.scrollLeft += shift;
      mine = scroller.scrollLeft;
    };

    const handOver = () => {
      handedOver = true;
    };

    const reach = () => {
      window.clearTimeout(releaseTimer);
      reaching = true;
    };

    // 指を離しても、勢いでしばらく流れつづける。その間も人のものとして扱う。
    const release = () => {
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(() => {
        reaching = false;
      }, 900);
    };

    const onScroll = () => {
      if (handedOver) return;
      // こちらが置いた場所なら、何もしない
      if (Math.abs(scroller.scrollLeft - mine) < 2) return;
      // 人が送ったのなら、そこで手を引く
      if (reaching) {
        handOver();
        return;
      }
      // 人が触れていないのに動いた。何かに戻されたので、置きなおす。
      align();
    };

    align();
    const frame = requestAnimationFrame(align);

    // 字体や写真が遅れて入ると幅が変わるので、寸法の変化も見張る
    const stream = scroller.querySelector<HTMLElement>("[data-stream]");
    const watcher = new ResizeObserver(align);
    if (stream) watcher.observe(stream);

    scroller.addEventListener("scroll", onScroll, { passive: true });
    // 輪や鍵は、それ自体が「送る」動きなので、触れた時点で人のものにする
    scroller.addEventListener("wheel", handOver, { passive: true });
    const reaches = ["touchstart", "pointerdown"] as const;
    const releases = ["touchend", "touchcancel", "pointerup", "pointercancel"] as const;
    reaches.forEach((name) => scroller.addEventListener(name, reach, { passive: true }));
    releases.forEach((name) => scroller.addEventListener(name, release, { passive: true }));

    const SENDING_KEYS = new Set([
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      "PageUp", "PageDown", "Home", "End", " ",
    ]);
    const onKey = (event: KeyboardEvent) => {
      if (SENDING_KEYS.has(event.key)) handOver();
    };
    window.addEventListener("keydown", onKey);

    // いつまでも張り合わないよう、しばらくしたら手を引く
    const stopWatching = window.setTimeout(handOver, WATCH_FOR);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(stopWatching);
      window.clearTimeout(releaseTimer);
      watcher.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("wheel", handOver);
      reaches.forEach((name) => scroller.removeEventListener(name, reach));
      releases.forEach((name) => scroller.removeEventListener(name, release));
      window.removeEventListener("keydown", onKey);
    };
  }, [scrollerId]);

  return null;
}
