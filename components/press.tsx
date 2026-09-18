"use client";

import { useEffect } from "react";

/**
 * 押した手応え（iOS）。
 *
 * iOS の Safari は、document に touchstart の聞き手が一つも無いと :active を出さない。
 * 空の聞き手を一つ置くだけで、指を置いた瞬間に釦や札が沈むようになる。
 * 何もしない passive の聞き手なので、送りの邪魔はしない。
 */
export function Press() {
  useEffect(() => {
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);
  return null;
}
