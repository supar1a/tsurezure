"use client";

import { useRef, useState } from "react";
import { useSound } from "./sound-provider";
import { deleteSlipAction, shareSlipAction } from "@/app/actions/slips";

export type PlaceOption = { id: string; name: string };

/**
 * 「グループにも投げる」。押すとモーダルが開き、グループをチェックで選ぶ（複数でよい）。
 * 置く側の <form> の中に入れる。チェックは placeIds として一緒に送られる。
 * モーダルの「投げる」は form を送る。「やめる」は開いたときのチェックに戻して閉じる。
 */
export function ShareDialog({
  places,
  checked,
  submitLabel = "投げる",
}: {
  places: PlaceOption[];
  checked: string[];
  submitLabel?: string;
}) {
  const { play } = useSound();
  const ref = useRef<HTMLDialogElement>(null);
  const snapshot = useRef<string[]>(checked);
  const [count, setCount] = useState(() => places.filter((p) => checked.includes(p.id)).length);

  const boxes = () => [...(ref.current?.querySelectorAll<HTMLInputElement>('input[name="placeIds"]') ?? [])];

  function open() {
    snapshot.current = boxes().filter((b) => b.checked).map((b) => b.value);
    play("rustle");
    ref.current?.showModal();
  }
  function cancel() {
    for (const b of boxes()) b.checked = snapshot.current.includes(b.value);
    setCount(snapshot.current.length);
    play("turn");
    ref.current?.close();
  }

  if (places.length === 0) return null;

  return (
    <>
      <button type="button" className="btn share-open" onClick={open}>
        グループにも投げる{count > 0 ? `（${count}）` : ""}
      </button>

      {/* form の中に置く。閉じていてもチェックは送られる（見えない欄と同じ）。 */}
      <dialog ref={ref} className="share-dialog" aria-label="投げる先">
        <div className="share-dialog-inner tate">
          <p className="share-dialog-title">どのグループに投げますか</p>
          <ul className="share-list">
            {places.map((p) => (
              <li key={p.id}>
                <label className="share-item">
                  <input
                    type="checkbox"
                    name="placeIds"
                    value={p.id}
                    defaultChecked={checked.includes(p.id)}
                    onChange={() => setCount(boxes().filter((b) => b.checked).length)}
                  />
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
    </>
  );
}

/** 一篇の頁で、投げる先を決め直す。 */
export function ShareControl({
  slipId,
  places,
  checked,
}: {
  slipId: string;
  places: PlaceOption[];
  checked: string[];
}) {
  return (
    <form action={shareSlipAction} className="share-form">
      <input type="hidden" name="slipId" value={slipId} />
      <ShareDialog places={places} checked={checked} submitLabel="これで決める" />
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
