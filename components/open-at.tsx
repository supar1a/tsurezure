"use client";

import { useEffect } from "react";

/** 巻きを置きなおすのをやめる時刻（開いてから何ミリ秒か）。 */
const WATCH_FOR = 8000;

type Edge = "left" | "right";

/**
 * ひらいたとき、どちらの端に立つか。
 *
 * 巻物と目次は左端（いちばん新しいところ）。一篇や名簿は右端（はじまり）。
 * スマホでもPCでも、開く場所がいつも同じであってほしいので、
 * 読みかけの位置ではなく、常にここに合わせる。
 *
 * 器（.scroll-tate）は横組みなので、送りの原点は左端。左端に立つ頁では、ひらいた時点で
 * もう原点に居る（この部品は、何かに動かされたときの置きなおしにだけ働く）。
 * 右端に立つ頁では、ひらいた直後にこちらから送る。送りは正の値だけを使う。
 * 縦組みの器で負の値を使うと、iOS の WebKit では中のものが押せなくなる。
 *
 * 置いたあとに、こちらの与り知らぬところで巻きが戻されることがある
 * （字体や写真が遅れて入る、再描画で中身が入れ替わる、焦点が見出しへ移る、など。
 * 端末や回線によって起きたり起きなかったりする）。
 * 一度きり置いて終わりにせず、しばらくは戻されたら置きなおす。
 *
 * ただし、**人が自分で送ったときだけは、二度と触らない。**
 * 読んでいる最中に巻きが引き戻されるのは、端で開くよりずっと悪い。
 * 指が触れただけでは引かず、触れたうえで実際に送られたときに手を引く。
 */
export function OpenAt({ edge = "left", scrollerId }: { edge?: Edge; scrollerId?: string }) {
  useEffect(() => {
    const scroller = scrollerId
      ? document.getElementById(scrollerId)
      : document.querySelector<HTMLElement>(".scroll-tate");
    if (!scroller) return;
    const stream = scroller.querySelector<HTMLElement>("[data-stream]");
    if (!stream) return;

    // 人に渡した。もうこちらからは動かさない。
    let handedOver = false;
    // こちらが最後に置いた位置。ここから離れていたら、誰かが動かしたということ。
    let mine = scroller.scrollLeft;
    // 指や輪が触れている最中。この間の動きは、人が送ったものとみなす。
    let reaching = false;
    let releaseTimer = 0;
    let nudge = 0;

    // 立つべき端と、中身のその端との差。0 なら着いている。
    const shift = () => {
      const s = stream.getBoundingClientRect();
      const v = scroller.getBoundingClientRect();
      return edge === "left" ? s.left - v.left : s.right - v.right;
    };

    const align = () => {
      if (handedOver) return;
      // 指や輪が触れている最中は、こちらからは動かさない。
      // 見張りと人の操作が競ると、送っているそばから引き戻すことになる。
      if (reaching) return;
      // 最後の一枚ではなく、中身そのものの端を画面の端に合わせる。
      // 一枚に合わせると、中身が自前で持っている余白のぶんだけ端まで行き着かない。
      // 一度では数ピクセル手前で止まることがあるので、動かなくなるまで詰める。
      for (let i = 0; i < 4; i++) {
        const d = shift();
        if (Math.abs(d) < 1) break;
        const was = scroller.scrollLeft;
        scroller.scrollLeft += d;
        if (scroller.scrollLeft === was) break; // これ以上は動けない（端に着いている）
      }
      mine = scroller.scrollLeft;
    };

    const handOver = () => {
      handedOver = true;
      window.clearInterval(nudge);
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

    /*
     * 開いた直後のあいだだけ、端との距離そのものを見張る。
     *
     * 寸法の変化を見ているだけでは足りない。字が組み直されると、器も中身の箱も
     * 同じ大きさのまま、巻きの伸びだけが変わることがある。そうなると
     * ResizeObserver は鳴らず、数ピクセル手前に取り残される。
     * align は端に着いていれば何もしないので、空振りは安い。
     */
    nudge = window.setInterval(align, 120);
    const stopNudging = window.setTimeout(() => window.clearInterval(nudge), 3000);

    /*
     * 寸法の変化を見張る。中身と器の両方を見る。
     * 中身は写真が遅れて入ると伸びる。器のほうも、字体が届くと右の柱の幅が変わり、
     * 巻きの見える幅がそのぶん動く。中身だけ見ていると、後者を取りこぼして
     * 数ピクセル手前で止まる。
     */
    const watcher = new ResizeObserver(align);
    watcher.observe(stream);
    watcher.observe(scroller);

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
      window.clearInterval(nudge);
      window.clearTimeout(stopNudging);
      window.clearTimeout(stopWatching);
      window.clearTimeout(releaseTimer);
      watcher.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("wheel", handOver);
      reaches.forEach((name) => scroller.removeEventListener(name, reach));
      releases.forEach((name) => scroller.removeEventListener(name, release));
      window.removeEventListener("keydown", onKey);
    };
  }, [edge, scrollerId]);

  return null;
}
