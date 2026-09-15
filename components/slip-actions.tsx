"use client";

import { useSound } from "./sound-provider";
import { deleteSlipAction, placeSlipAction, withdrawSlipAction } from "@/app/actions/slips";

export type PlaceOption = { id: string; name: string };

/**
 * 共有先を選ぶ。「共有しない（自分のみ）」か、入っているグループのどれか一つ。
 * defaultPlaceId が null なら「共有しない」、文字列ならそのグループが選ばれた状態で出る。
 */
export function ShareSelect({
  places,
  defaultPlaceId,
  name = "placeId",
}: {
  places: PlaceOption[];
  defaultPlaceId?: string | null;
  name?: string;
}) {
  const chosen = places.some((p) => p.id === defaultPlaceId) ? defaultPlaceId! : "";
  return (
    <label className="share-pick">
      <span className="field-label">共有先</span>
      <select name={name} className="input share-select" defaultValue={chosen}>
        <option value="">共有しない（自分のみ）</option>
        {places.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 一篇の共有。共有していれば「共有をやめる」、していなければ共有先を選んで「共有する」。 */
export function ShareControl({
  slipId,
  shared,
  places,
  defaultPlaceId,
}: {
  slipId: string;
  shared: boolean;
  places: PlaceOption[];
  defaultPlaceId?: string | null;
}) {
  const { play } = useSound();

  if (shared) {
    return (
      <form action={withdrawSlipAction}>
        <input type="hidden" name="slipId" value={slipId} />
        <button type="submit" className="btn btn-quiet" onClick={() => play("rustle")}>
          共有をやめる
        </button>
      </form>
    );
  }

  if (places.length === 0) return null;

  return (
    <form action={placeSlipAction} className="share-form">
      <input type="hidden" name="slipId" value={slipId} />
      <ShareSelect places={places} defaultPlaceId={defaultPlaceId ?? places[0].id} />
      <button type="submit" className="btn btn-ink" onClick={() => play("ink")}>
        共有する
      </button>
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
