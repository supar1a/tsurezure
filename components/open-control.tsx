"use client";

import { useState, useTransition } from "react";
import { setOpenAction } from "@/app/actions/slips";
import { useSound } from "./sound-provider";

/**
 * 一枚を「リンクで公開」する。書いた本人だけ。
 *
 * 入れている間だけ、この一枚の URL を知っている人なら誰でも本文を読める。
 * スペースの名前も、ほかの一枚も見えない。切れば、また仲間内だけに戻る。
 * 公開中であることは、はっきり出す（切り忘れに気づけるように）。
 */
export function OpenControl({ slipId, open }: { slipId: string; open: boolean }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const { play } = useSound();

  function turnOn() {
    if (
      !window.confirm(
        "この一枚を、URL を知っている人なら誰でも読めるようにします。\nスペースの名前や、ほかの一枚は見えません。",
      )
    )
      return;
    play("turn");
    start(() => setOpenAction(slipId, true));
  }

  function turnOff() {
    play("turn");
    start(() => setOpenAction(slipId, false));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/post/${slipId}`);
      play("tick");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // クリップボードが使えなければ、URL 欄から写してもらう
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-quiet" onClick={turnOn} disabled={pending}>
        リンクで公開する
      </button>
    );
  }

  return (
    <>
      <span className="sheet-open">公開中</span>
      <button type="button" className="btn" onClick={copy}>
        {copied ? "コピーしました" : "リンクをコピー"}
      </button>
      <button type="button" className="btn btn-quiet" onClick={turnOff} disabled={pending}>
        公開をやめる
      </button>
    </>
  );
}
