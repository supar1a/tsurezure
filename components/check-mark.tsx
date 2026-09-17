"use client";

import { useTransition } from "react";
import { toggleCheckAction } from "@/app/actions/slips";
import { useSound } from "./sound-provider";
import { BOX, CHECKED } from "@/lib/marks";

/**
 * 本文のチェック。書いた本人が読んでいるときは押せて、その場で反転する。
 * ほかの人には、ただの字。
 */
export function CheckMark({
  done,
  slipId,
  lineIndex,
}: {
  done: boolean;
  slipId?: string;
  lineIndex: number;
}) {
  const [pending, start] = useTransition();
  const { play } = useSound();
  const glyph = done ? CHECKED : BOX;

  if (!slipId) return <span className="line-mark">{glyph} </span>;

  return (
    <button
      type="button"
      className="line-mark line-check"
      aria-pressed={done}
      disabled={pending}
      onClick={() => {
        play("tick");
        start(() => toggleCheckAction(slipId, lineIndex));
      }}
    >
      {glyph}
    </button>
  );
}
