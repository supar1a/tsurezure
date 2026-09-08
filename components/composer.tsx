"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { TITLE_MAX, countChars } from "@/lib/text";
import { useSound } from "./sound-provider";
import type { FormState } from "@/app/actions/slips";

type Attached = { url: string; width: number; height: number; local: boolean };

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  /** 題（無くてよい） */
  defaultTitle?: string;
  /** 写真より前の本文 */
  defaultBefore?: string;
  /** 写真より後ろの本文 */
  defaultAfter?: string;
  /** すでに貼ってある一枚（書き直しのとき） */
  defaultPhoto?: { id: string; width: number; height: number } | null;
  /** すでに公開しているものを編集しているとき */
  published?: boolean;
  cancel?: React.ReactNode;
};

// 貼った写真は、送る前にここまで縮める
const MAX_SIDE = 1600;
const QUALITY = 0.82;

/**
 * 書く場。
 *
 * 写真は印ではなく、そのものが本文のあいだに挟まる。
 * 貼るとカーソルのところで本文が二つに割れ、そこに写真が入る。
 * 外すとまた一つにつながる。目に見えているとおりに出る。
 */
export function Composer({
  action,
  hidden,
  defaultTitle = "",
  defaultBefore = "",
  defaultAfter = "",
  defaultPhoto = null,
  published = false,
  cancel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [photo, setPhoto] = useState<Attached | null>(
    defaultPhoto
      ? {
          url: `/photo/${defaultPhoto.id}`,
          width: defaultPhoto.width,
          height: defaultPhoto.height,
          local: false,
        }
      : null,
  );
  const [afterSeed, setAfterSeed] = useState(defaultAfter);
  const [afterKey, setAfterKey] = useState(0);
  const [count, setCount] = useState(() => countChars(defaultBefore + defaultAfter));
  // 題の残り。打てなくなってから気づくのでは遅いので、終わりが近づいたら見せる。
  const [titleLeft, setTitleLeft] = useState(() => TITLE_MAX - defaultTitle.length);
  const [trouble, setTrouble] = useState<string | null>(null);

  const { play } = useSound();
  const lastStroke = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const beforeRef = useRef<HTMLTextAreaElement>(null);
  const afterRef = useRef<HTMLTextAreaElement>(null);
  const justPasted = useRef(false);

  // 見せている間だけの URL なので、置き換わったら手放す
  useEffect(() => {
    return () => {
      if (photo?.local) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  // 貼ったあとは、写真の続きから書けるようにする
  useEffect(() => {
    if (!justPasted.current) return;
    justPasted.current = false;
    const el = afterRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(0, 0);
  }, [afterKey]);

  function tally() {
    setCount(countChars((beforeRef.current?.value ?? "") + (afterRef.current?.value ?? "")));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // ⌘/Ctrl + Enter で送る。
    // 変換の確定にも Enter を使うので、変換中は決して送らない。
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      if (event.nativeEvent.isComposing) return;
      event.preventDefault();
      play("ink");
      formRef.current?.requestSubmit(submitRef.current ?? undefined);
      return;
    }

    // 打鍵のたびに筆の音。連打で音が濁らないよう、間隔を空ける。
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.length !== 1 && event.key !== "Enter" && event.key !== "Backspace") return;
    const now = performance.now();
    if (now - lastStroke.current < 42) return;
    lastStroke.current = now;
    play("stroke");
  }

  /** 写真は貼り付けでだけ入る。文字の貼り付けは邪魔しない。 */
  async function onPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const item = [...event.clipboardData.items].find((i) => i.type.startsWith("image/"));
    if (!item) return;

    event.preventDefault();
    const file = item.getAsFile();
    if (!file) return;

    // currentTarget は配信のあいだしか生きていない。待つ前に掴んでおく。
    const target = event.currentTarget;
    const caret = target.selectionStart ?? target.value.length;

    setTrouble(null);
    try {
      const shrunk = await shrink(file);
      const input = fileRef.current;
      if (!input) return;

      const carrier = new DataTransfer();
      carrier.items.add(new File([shrunk.blob], "photo.jpg", { type: "image/jpeg" }));
      input.files = carrier.files;

      // まだ写真がなければ、いま書いているところで本文を割る
      if (!photo) {
        const tail = target.value.slice(caret);
        target.value = target.value.slice(0, caret);
        setAfterSeed(tail);
        setAfterKey((n) => n + 1);
        justPasted.current = true;
      }

      if (photo?.local) URL.revokeObjectURL(photo.url);
      setPhoto({
        url: URL.createObjectURL(shrunk.blob),
        width: shrunk.width,
        height: shrunk.height,
        local: true,
      });
      play("rustle");
    } catch {
      setTrouble("その画像は貼れませんでした。別の形式で試してみてください。");
    }
  }

  /** 外すと、割れていた本文がまたつながる。 */
  function detach() {
    if (fileRef.current) fileRef.current.value = "";

    const head = beforeRef.current?.value ?? "";
    const tail = afterRef.current?.value ?? "";
    if (beforeRef.current) {
      beforeRef.current.value = [head.trimEnd(), tail.trimStart()].filter(Boolean).join("\n\n");
    }

    if (photo?.local) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    setAfterSeed("");
    tally();
    play("turn");
    beforeRef.current?.focus();
  }

  return (
    <form ref={formRef} action={formAction} className="compose">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input ref={fileRef} type="file" name="photo" accept="image/*" hidden />
      <input type="hidden" name="photoWidth" value={photo?.width ?? ""} />
      <input type="hidden" name="photoHeight" value={photo?.height ?? ""} />
      <input type="hidden" name="photoRemove" value={!photo && defaultPhoto ? "1" : ""} />

      <div className="compose-shell">
        <textarea
          name="title"
          className="compose-title"
          placeholder="題（なくてよい）"
          defaultValue={defaultTitle}
          maxLength={TITLE_MAX}
          rows={1}
          spellCheck={false}
          onChange={(event) => setTitleLeft(TITLE_MAX - event.currentTarget.value.length)}
          onKeyDown={(event) => {
            // 題は一行きり。改行では送らない。
            if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              return;
            }
            onKeyDown(event);
          }}
        />

        <textarea
          ref={beforeRef}
          name="bodyBefore"
          className="compose-body"
          placeholder="ここから、書く。"
          defaultValue={defaultBefore}
          autoFocus
          spellCheck={false}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onChange={tally}
        />

        {photo ? (
          <>
            <div className="compose-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" width={photo.width} height={photo.height} />
              <button type="button" className="btn btn-quiet compose-photo-off" onClick={detach}>
                外す
              </button>
            </div>

            <textarea
              key={afterKey}
              ref={afterRef}
              name="bodyAfter"
              className="compose-body"
              placeholder="つづき"
              defaultValue={afterSeed}
              spellCheck={false}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              onChange={tally}
            />
          </>
        ) : null}
      </div>

      {state?.error ? <p className="notice">{state.error}</p> : null}
      {trouble ? <p className="notice">{trouble}</p> : null}

      <div className="compose-foot">
        <button
          ref={submitRef}
          type="submit"
          name="intent"
          value="publish"
          className="btn btn-ink"
          disabled={pending}
          onClick={() => play("ink")}
        >
          {published ? "保存する" : "書き残す"}
        </button>

        <button
          type="submit"
          name="intent"
          value="draft"
          className="btn"
          disabled={pending}
          onClick={() => play("rustle")}
        >
          下書きに保存
        </button>

        {cancel}

        {/* 題の上限は、ぶつかる手前でだけ言う。ずっと出していると急かしになる。 */}
        {titleLeft <= 10 ? (
          <span className="compose-count">題はあと{titleLeft}字</span>
        ) : null}

        <span className="compose-count">{count > 0 ? `${count}字` : "　"}</span>
      </div>
    </form>
  );
}

/** 送る前に縮める。スマホの一枚をそのまま送ると、上限にも回線にも重い。 */
async function shrink(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("描けませんでした");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error("書き出せませんでした");

  return { blob, width, height };
}
