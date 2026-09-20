"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TITLE_MAX, countChars } from "@/lib/text";
import { autoMark, continueMark } from "@/lib/marks";
import { useSound } from "./sound-provider";
import { DrawnCaret } from "./drawn-caret";
import { IosRepaint } from "./ios-repaint";
import { ShareDialog, type PlaceOption, type ShareDialogHandle } from "./slip-actions";
import { clearDraft, readDraft, writeDraft } from "@/lib/draft";
import { PaperLink } from "./paper-link";
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
  /** すでに部屋に置いてあるものを編集しているとき */
  published?: boolean;
  /** やめたときの戻り先。書きかけがあれば、戻る前に一度たずねる。 */
  cancelHref: string;
  /** 投げる先の候補（入っているスペース）と、先にチェックしておくスペース */
  places?: PlaceOption[];
  defaultPlaceIds?: string[];
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
  cancelHref,
  places,
  defaultPlaceIds = [],
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
  // 題の欄を出しているか。狭い画面では、頼まれるまで出さない（幅を本文に譲る）。
  // 広い画面では CSS が常に出す。すでに題があれば、はじめから出す。
  const [titleOpen, setTitleOpen] = useState(() => defaultTitle.length > 0);

  const { play } = useSound();
  const path = usePathname();
  // 書きかけがあるか。控えと「戻ってよいか」の問いは、これで決める
  const [dirty, setDirty] = useState(false);
  // 差し出している控え（新しく書くときだけ）
  const [offer, setOffer] = useState<{ title: string; before: string; after: string } | null>(null);
  const lastStroke = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const shareRef = useRef<ShareDialogHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const beforeRef = useRef<HTMLTextAreaElement>(null);
  const afterRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const justPasted = useRef(false);
  const wantTitle = useRef(false);

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

  // 題を出したら、そのまま題から書けるようにする
  useEffect(() => {
    if (!wantTitle.current) return;
    wantTitle.current = false;
    titleRef.current?.focus();
  }, [titleOpen]);

  const readAll = useCallback(() => ({
    title: titleRef.current?.value ?? "",
    before: beforeRef.current?.value ?? "",
    after: afterRef.current?.value ?? "",
  }), []);

  /** 書きかけかどうか。はじめに入っていたものと違えば、書きかけ。 */
  const isDirty = useCallback(() => {
    const now = readAll();
    return now.title !== defaultTitle || now.before !== defaultBefore || now.after !== defaultAfter;
  }, [readAll, defaultTitle, defaultBefore, defaultAfter]);

  /*
   * 書きかけの控え。新しく書くときだけ持つ（編集には元の一篇があるので持たない）。
   * ひらいたときに同じ場所の控えがあれば、戻すかどうかを一行でたずねる。勝手には戻さない。
   */
  useEffect(() => {
    if (published) return;
    // 組み上がってから差し出す（描いている最中に状態を変えない）
    const timer = window.setTimeout(() => {
      const found = readDraft(path);
      if (found) setOffer({ title: found.title, before: found.before, after: found.after });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [published, path]);

  // 打つたびに控える。打鍵ごとに書き出すと重いので、手が止まってから
  useEffect(() => {
    if (published || !dirty) return;
    const timer = window.setTimeout(() => writeDraft({ path, ...readAll() }), 600);
    return () => window.clearTimeout(timer);
  }, [published, dirty, path, readAll, count, titleLeft]);

  // 窓を閉じる・読み込み直すとき
  useEffect(() => {
    if (!dirty) return;
    const ask = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [dirty]);

  /*
   * 「戻る」を押したとき。履歴に一つ余分に積んでおき、戻ってきたところでたずねる。
   * 留まるなら積み直し、戻るならもう一度戻す。
   */
  const pushed = useRef(false);
  const ask = useRef<() => boolean>(() => true);
  useEffect(() => {
    if (!dirty) return;
    if (!pushed.current) { history.pushState(null, "", location.href); pushed.current = true; }
    const onPop = () => {
      if (ask.current()) { pushed.current = false; history.back(); }
      else history.pushState(null, "", location.href);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dirty]);

  /** 書きかけを置いて戻ってよいか。控えがあることも伝える。 */
  function askLeave() {
    if (!isDirty()) return true;
    return window.confirm(
      published
        ? "書きかけがあります。戻ると、直したところは失われます。よろしいですか。"
        : "書きかけがあります。戻っても書きかけは控えてあり、次に書くときに戻せます。よろしいですか。",
    );
  }

  // 聞き手は一度だけ登録し、中身はここで差し替える（登録し直すと履歴が二重に積まれる）
  useEffect(() => { ask.current = askLeave; });

  function restore() {
    if (!offer) return;
    const set = (el: HTMLTextAreaElement | null, v: string) => {
      if (!el) return;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    if (offer.title) { wantTitle.current = false; setTitleOpen(true); }
    // 題の欄は、開いてから入れる
    window.setTimeout(() => set(titleRef.current, offer.title), 0);
    set(beforeRef.current, offer.before);
    set(afterRef.current, offer.after);
    setTitleLeft(TITLE_MAX - offer.title.length);
    setOffer(null);
    play("turn");
  }

  function openTitle() {
    wantTitle.current = true;
    setTitleOpen(true);
  }

  function tally() {
    setCount(countChars((beforeRef.current?.value ?? "") + (afterRef.current?.value ?? "")));
    // 書きはじめたら、注意は引っ込める
    setTrouble(null);
    setDirty(isDirty());
  }

  /**
   * 投稿する。スペースに入っていれば、投稿先を選ぶモーダルを開く（ひとりのスペースはいつもチェック）。
   * どのスペースにも入っていなければ、選ぶものが無いのでそのまま送る。
   */
  function post() {
    // 何も書いていなければ、送る前にここで言う。モーダルを開いてから知るのでは遅い。
    const written =
      (beforeRef.current?.value ?? "").trim() || (afterRef.current?.value ?? "").trim() || photo;
    if (!written) {
      setTrouble("まだ何も書かれていません。");
      beforeRef.current?.focus();
      return;
    }
    setTrouble(null);
    if (places && places.length > 0) {
      clearDraft();
      shareRef.current?.open();
      return;
    }
    play("ink");
    clearDraft();
    formRef.current?.requestSubmit();
  }

  /** 欄の中身を差し替えて、React にも気づかせる。 */
  function rewrite(el: HTMLTextAreaElement, value: string, caret: number) {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    set?.call(el, value);
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /** 打ったばかりの「- 」「1. 」「[ ] 」を、その場で ・ 一、 ☐ に置き換える。 */
  function onBodyInput(event: React.FormEvent<HTMLTextAreaElement>) {
    const el = event.currentTarget;
    if ((event.nativeEvent as InputEvent).isComposing) return;
    const edit = autoMark(el.value, el.selectionStart ?? el.value.length);
    if (edit) rewrite(el, edit.value, edit.caret);
    tally();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // ⌘/Ctrl + Enter で投稿する（釦を押したのと同じ）。
    // 変換の確定にも Enter を使うので、変換中は決して送らない。
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      if (event.nativeEvent.isComposing) return;
      event.preventDefault();
      post();
      return;
    }

    // 箇条書きの行で Enter：次の行にも印を立てる。空の項目なら印を消して終える。
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      const el = event.currentTarget;
      if (el.classList.contains("compose-body")) {
        const edit = continueMark(el.value, el.selectionStart ?? el.value.length);
        if (edit) {
          event.preventDefault();
          rewrite(el, edit.value, edit.caret);
        }
      }
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
    <form ref={formRef} action={formAction} className="compose" data-title={titleOpen ? "open" : "closed"}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input ref={fileRef} type="file" name="photo" accept="image/*" hidden />
      <input type="hidden" name="photoWidth" value={photo?.width ?? ""} />
      <input type="hidden" name="photoHeight" value={photo?.height ?? ""} />
      <input type="hidden" name="photoRemove" value={!photo && defaultPhoto ? "1" : ""} />

      <div className="compose-shell">
        <textarea
          ref={titleRef}
          name="title"
          className="compose-title"
          placeholder="題名"
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
        <DrawnCaret target={titleRef} />
        <IosRepaint />

        <textarea
          ref={beforeRef}
          name="bodyBefore"
          className="compose-body"
          placeholder="本文"
          defaultValue={defaultBefore}
          autoFocus
          spellCheck={false}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onInput={onBodyInput}
        />
        <DrawnCaret target={beforeRef} />

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
              onInput={onBodyInput}
            />
            <DrawnCaret key={`caret-${afterKey}`} target={afterRef} />
          </>
        ) : null}
      </div>

      {offer ? (
        <p className="notice compose-draft">
          書きかけがあります。
          <button type="button" className="btn btn-quiet" onClick={restore}>戻す</button>
          <button type="button" className="btn btn-quiet btn-faint" onClick={() => { setOffer(null); clearDraft(); }}>捨てる</button>
        </p>
      ) : null}

      {state?.error ? <p className="notice">{state.error}</p> : null}
      {trouble ? <p className="notice">{trouble}</p> : null}

      {/*
        釦の帯。書き終えたさき——縦組みではいちばん左——に立つ。
        鍵盤が出ても場ごと縮むので、帯はいつも見えている。
      */}
      <div className="compose-foot">
        {/* 入口は一つ。押すと投稿先を選ぶモーダルが開く。スペースの中から書けば、そのスペースが先にチェックされている。 */}
        <button type="button" className="btn btn-ink" disabled={pending} onClick={post}>
          {published ? "保存する" : "投稿する"}
        </button>
        {places ? (
          <ShareDialog
            ref={shareRef}
            places={places}
            checked={defaultPlaceIds}
            submitLabel={published ? "保存する" : "投稿する"}
            title={published ? "どこに投稿しておきますか" : "どこに投稿しますか"}
          />
        ) : null}

        {/* 狭い画面でだけ見える。押せば題の欄が出て、この釦は引っ込む。 */}
        {!titleOpen ? (
          <button type="button" className="btn btn-quiet compose-title-open" onClick={openTitle}>
            題名を付ける
          </button>
        ) : null}

        <PaperLink
          href={cancelHref}
          className="btn btn-quiet"
          voice="rustle"
          onClick={(event) => { if (!askLeave()) event.preventDefault(); }}
        >
          やめる
        </PaperLink>

        <span className="compose-tally">
          {/* 題の上限は、ぶつかる手前でだけ言う。ずっと出していると急かしになる。 */}
          {titleLeft <= 10 ? (
            <span className="compose-count">題名はあと{titleLeft}字</span>
          ) : null}
          <span className="compose-count">{count > 0 ? `${count}字` : "　"}</span>
        </span>
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
