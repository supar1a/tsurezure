"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { useSound } from "./sound-provider";
import { deleteSlipAction, shareSlipAction } from "@/app/actions/slips";

export type PlaceOption = { id: string; name: string };
export type ShareDialogHandle = { open: () => void };

/**
 * 投稿先を選ぶモーダル。置く側の <form> の中に入れる。チェックは placeIds として一緒に送られる。
 * 「ひとりのスペース」はいつもチェック（外せない。投稿はかならずひとりのスペースに残る）。
 * スペースはチェックしたものにだけ投げる。「やめる」は開いたときのチェックに戻して閉じる。
 * 入口は持たない。置く側が open() で開く（投稿する釦、⌘+Enter、投稿先を変える釦）。
 */
export const ShareDialog = forwardRef<
  ShareDialogHandle,
  { places: PlaceOption[]; checked: string[]; submitLabel?: string; title?: string }
>(function ShareDialog({ places, checked, submitLabel = "投稿する", title = "どこに投稿しますか" }, handle) {
  const { play } = useSound();
  const ref = useRef<HTMLDialogElement>(null);
  const snapshot = useRef<string[]>(checked);

  const boxes = () => [...(ref.current?.querySelectorAll<HTMLInputElement>('input[name="placeIds"]') ?? [])];

  useImperativeHandle(handle, () => ({
    open() {
      snapshot.current = boxes().filter((b) => b.checked).map((b) => b.value);
      play("rustle");
      ref.current?.showModal();
    },
  }));

  function cancel() {
    for (const b of boxes()) b.checked = snapshot.current.includes(b.value);
    play("turn");
    ref.current?.close();
  }

  return (
    <dialog ref={ref} className="share-dialog" aria-label={title}>
      <div className="share-dialog-inner tate">
        <p className="share-dialog-title">{title}</p>
        <ul className="share-list">
          <li>
            {/* ひとりのスペースは確定。選ぶものではないので、チェックボックスではなく済みの印を置く */}
            <span className="share-item share-item-self" title="投稿はかならずひとりのスペースに残ります">
              <span className="share-fixed" aria-hidden="true" />
              <span>ひとりのスペース</span>
              <span className="share-fixed-note">いつも</span>
            </span>
          </li>
          {places.map((p) => (
            <li key={p.id}>
              <label className="share-item">
                <input type="checkbox" name="placeIds" value={p.id} defaultChecked={checked.includes(p.id)} />
                <span>{p.name}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="share-dialog-foot">
          <button type="submit" className="btn btn-ink" onClick={() => play("ink")}>
            {submitLabel}
          </button>
          <button type="button" className="btn btn-quiet" onClick={cancel}>
            やめる
          </button>
        </div>
      </div>
    </dialog>
  );
});

/** 一篇の頁で、投稿先を決め直す。 */
export function ShareControl({
  slipId,
  places,
  checked,
}: {
  slipId: string;
  places: PlaceOption[];
  checked: string[];
}) {
  const { play } = useSound();
  const dialog = useRef<ShareDialogHandle>(null);
  if (places.length === 0) return null;
  return (
    <form action={shareSlipAction} className="share-form">
      <input type="hidden" name="slipId" value={slipId} />
      <button type="button" className="btn btn-quiet" onClick={() => { play("rustle"); dialog.current?.open(); }}>
        投稿先を変える
      </button>
      <ShareDialog ref={dialog} places={places} checked={checked} submitLabel="これで決める" title="どこに投稿しますか" />
    </form>
  );
}

export function DeleteSlip({ slipId }: { slipId: string }) {
  const { play } = useSound();

  return (
    <form
      action={deleteSlipAction}
      onSubmit={(event) => {
        if (!window.confirm("この投稿を削除します。写真も一緒に消えます。もとには戻せません。")) {
          event.preventDefault();
          return;
        }
        play("turn");
      }}
    >
      <input type="hidden" name="slipId" value={slipId} />
      <button type="submit" className="btn btn-quiet" style={{ color: "var(--sumi-faint)" }}>
        削除
      </button>
    </form>
  );
}
