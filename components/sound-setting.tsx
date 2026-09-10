"use client";

import { useSound } from "./sound-provider";

/**
 * 紙の音を鳴らすかどうか。
 *
 * これは見ている頁の持ちものではなく、あなたの持ちもの。
 * だから柱ではなく、あなたの頁に置いてある。
 */
export function SoundSetting() {
  const { muted, toggle } = useSound();

  return (
    <div className="leaf-section">
      <p className="caption">いま、{muted ? "鳴りません。" : "鳴ります。"}</p>
      <div className="row">
        <button type="button" onClick={toggle} className="btn" aria-pressed={!muted}>
          {muted ? "鳴らす" : "止める"}
        </button>
      </div>
    </div>
  );
}
