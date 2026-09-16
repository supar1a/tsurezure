"use client";

import { useEffect } from "react";

/**
 * iOS で、縦組みの入力欄から字を消したあと、消えた状態が描かれないことがある（2026-09-16 実機で報告）。
 * 打った字は出るのに、バックスペースで消しても消える前の絵が残り、次に何か打つと直る。
 * 中身（value）は正しいので、WebKit が「短くなった」ぶんの描き直しを取りこぼしている。
 *
 * 手当て：消す入力（inputType が delete で始まる）のあと、字の見た目にだけ効く書式を
 * 一瞬付けて外す。書式が変われば WebKit は箱ごと描き直す。text-shadow の透明は
 * 目には何も変えない。焦点も変換も動かさない。
 *
 * デスクトップの WebKit では起きない（Playwright で確かめた）ので、iOS だけに限る。
 */
const IOS =
  typeof navigator !== "undefined" &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export function IosRepaint() {
  useEffect(() => {
    if (!IOS) return;
    const onInput = (event: Event) => {
      const el = event.target;
      if (!(el instanceof HTMLTextAreaElement)) return;
      const type = (event as InputEvent).inputType ?? "";
      if (!type.startsWith("delete")) return;
      el.style.textShadow = "0 0 0 transparent";
      requestAnimationFrame(() => {
        el.style.textShadow = "";
      });
    };
    document.addEventListener("input", onInput);
    return () => document.removeEventListener("input", onInput);
  }, []);
  return null;
}
