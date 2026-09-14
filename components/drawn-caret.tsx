"use client";

import { useEffect, type RefObject } from "react";

/**
 * iOS では、挿入ポイントを自前で描く。
 *
 * iOS の WebKit は、縦組みの入力欄にも横書き用の挿入ポイント（青い棒に丸い掴み）を描く。
 * 縦組みでは字の下に置く横棒であるべきところが紡錘形に見え、改行したあとの位置も
 * 次の行の頭に来ない。描画はブラウザの持ちものなので、直す手立ては
 * **生の挿入ポイントを透明にして、こちらで描く**しかない。
 *
 * 位置は、入力欄と同じ組みの写し（mirror）に同じ文字を流し、挿入位置に印を置いて測る。
 * 入力欄そのものは隠さないので、かな漢字変換の下線や候補はそのまま出る。
 * 変換中はこちらの棒を消して、下線に任せる。
 *
 * 他のブラウザは自前の描きかたで足りているので、触らない。
 */
const IOS =
  typeof navigator !== "undefined" &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const COPIED = [
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "fontFeatureSettings",
  "letterSpacing", "lineHeight", "textIndent", "textTransform",
  "writingMode", "textOrientation", "lineBreak", "wordBreak", "overflowWrap",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "boxSizing", "direction", "tabSize",
] as const;

export function DrawnCaret({ target }: { target: RefObject<HTMLTextAreaElement | null> }) {
  useEffect(() => {
    if (!IOS) return;
    const area = target.current;
    const host = area?.parentElement;
    if (!area || !host) return;

    const mirror = document.createElement("div");
    mirror.className = "caret-mirror";
    mirror.setAttribute("aria-hidden", "true");
    const mark = document.createElement("span");
    mark.textContent = "​";
    const caret = document.createElement("div");
    caret.className = "caret";
    caret.hidden = true;
    host.append(mirror, caret);
    area.classList.add("caret-quiet");

    let composing = false;
    let frame = 0;
    // 書式の写しは、寸法や字体が変わったときだけ取り直す（打つたびに getComputedStyle を呼ばない）
    let em = 16;
    let dressed = false;
    const dress = () => {
      const style = getComputedStyle(area);
      for (const name of COPIED) mirror.style[name] = style[name];
      em = parseFloat(style.fontSize) || 16;
      dressed = true;
    };

    const place = () => {
      frame = 0;
      if (document.activeElement !== area || composing) {
        caret.hidden = true;
        return;
      }
      if (!dressed) dress();

      const box = area.getBoundingClientRect();
      const home = host.getBoundingClientRect();
      mirror.style.left = `${box.left - home.left}px`;
      mirror.style.top = `${box.top - home.top}px`;
      mirror.style.width = `${box.width}px`;
      mirror.style.height = `${box.height}px`;

      const at = area.selectionStart ?? area.value.length;
      // 印のあとに何も無いと最後の行が潰れるので、幅の無い字を置いておく
      mirror.replaceChildren(
        document.createTextNode(area.value.slice(0, at)),
        mark,
        document.createTextNode(area.value.slice(at) || "​"),
      );
      mirror.scrollLeft = area.scrollLeft;
      mirror.scrollTop = area.scrollTop;

      const m = mark.getBoundingClientRect();
      // 入力欄の外（送られて見えていないところ）なら描かない
      if (m.top < box.top - 1 || m.top > box.bottom + 1 || m.left < box.left - 1 || m.right > box.right + 1) {
        caret.hidden = true;
        return;
      }
      // 棒の長さは一字ぶん。印の箱は字面より少し広いので、真ん中に合わせて詰める。
      caret.style.left = `${m.left - home.left + (m.width - em) / 2}px`;
      caret.style.top = `${m.top - home.top}px`;
      caret.style.width = `${em}px`;
      // 動いたら、点滅を頭から
      caret.style.animation = "none";
      void caret.offsetWidth;
      caret.style.animation = "";
      caret.hidden = false;
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    const undress = () => {
      dressed = false;
      soon();
    };
    const onCompositionStart = () => { composing = true; soon(); };
    const onCompositionEnd = () => { composing = false; soon(); };

    const own = ["input", "keyup", "click", "focus", "blur", "scroll", "select"] as const;
    own.forEach((name) => area.addEventListener(name, soon));
    area.addEventListener("compositionstart", onCompositionStart);
    area.addEventListener("compositionend", onCompositionEnd);
    document.addEventListener("selectionchange", soon);
    window.addEventListener("resize", undress);
    window.visualViewport?.addEventListener("resize", undress);
    document.fonts?.addEventListener("loadingdone", undress);
    soon();

    return () => {
      cancelAnimationFrame(frame);
      own.forEach((name) => area.removeEventListener(name, soon));
      area.removeEventListener("compositionstart", onCompositionStart);
      area.removeEventListener("compositionend", onCompositionEnd);
      document.removeEventListener("selectionchange", soon);
      window.removeEventListener("resize", undress);
      window.visualViewport?.removeEventListener("resize", undress);
      document.fonts?.removeEventListener("loadingdone", undress);
      area.classList.remove("caret-quiet");
      mirror.remove();
      caret.remove();
    };
  }, [target]);

  return null;
}
