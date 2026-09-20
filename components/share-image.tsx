"use client";

import { useEffect, useRef, useState } from "react";
import { useSound } from "./sound-provider";
import { renderStory, type StorySource } from "@/lib/story";

/**
 * 一篇を縦書きの絵にして、端末の共有シートに渡す。
 * iPhone なら「共有 → Instagram → ストーリーズ」で、その絵が入る。
 * 共有シートが使えないところでは、絵を保存する。書いた本人だけ。
 *
 * 共有シートは「押した直後」にしか開けない（待たせると断られる）。
 * だから絵は頁を開いたときに先に描いておき、押した瞬間にそのまま渡す。
 */
export function ShareImage({ slip }: { slip: StorySource }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { play } = useSound();
  const ready = useRef<Promise<File> | null>(null);

  const prepare = () => {
    if (!ready.current) {
      ready.current = renderStory(slip).then((blob) => new File([blob], "tsurezure.png", { type: "image/png" }));
    }
    return ready.current;
  };

  // 頁がひらいて落ち着いたら、裏で描いておく
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const kick = () => { prepare().catch(() => { ready.current = null; }); };
    if (idle) idle(kick); else setTimeout(kick, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slip.title, slip.body, slip.date, slip.time]);

  async function share() {
    setBusy(true);
    setNote(null);
    try {
      const file = await prepare();
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        play("turn");
        await nav.share({ files: [file] });
      } else {
        // 共有シートが無い（PC など）：保存に落とす
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = "tsurezure.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setNote("絵を保存しました。");
      }
    } catch (e) {
      // 共有シートを閉じただけなら何も言わない
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.error(e);
      setNote("絵にできませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-quiet" onClick={share} disabled={busy}>
        {busy ? "…" : "画像にして共有"}
      </button>
      {note ? <span className="sheet-shared">{note}</span> : null}
    </>
  );
}
