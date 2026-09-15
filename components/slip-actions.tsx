"use client";

import { useSound } from "./sound-provider";
import { deleteSlipAction, placeSlipAction, withdrawSlipAction } from "@/app/actions/slips";

export type PlaceOption = { id: string; name: string };

/** 置く先を選ぶ。部屋が一つなら選ばせない。「いつもここに置く」も添える。 */
export function PlacePicker({
  places,
  defaultPlaceId,
  name = "placeId",
}: {
  places: PlaceOption[];
  defaultPlaceId?: string | null;
  name?: string;
}) {
  if (places.length === 0) return <p className="notice">置ける部屋がまだありません。</p>;
  const chosen = places.find((p) => p.id === defaultPlaceId)?.id ?? places[0].id;
  return (
    <span className="place-pick">
      {places.length === 1 ? (
        <input type="hidden" name={name} value={places[0].id} />
      ) : (
        <select name={name} className="input place-select" defaultValue={chosen} aria-label="置く先">
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <label className="place-remember">
        <input type="checkbox" name="remember" value="1" defaultChecked={!!defaultPlaceId} />
        いつもここに置く
      </label>
    </span>
  );
}

/** 帳面の一篇を部屋に置く。置いてあれば、帳面へ戻す。 */
export function PlaceToggle({
  slipId,
  placed,
  places,
  defaultPlaceId,
}: {
  slipId: string;
  placed: boolean;
  places: PlaceOption[];
  defaultPlaceId?: string | null;
}) {
  const { play } = useSound();

  if (placed) {
    return (
      <form action={withdrawSlipAction}>
        <input type="hidden" name="slipId" value={slipId} />
        <button type="submit" className="btn btn-quiet" onClick={() => play("rustle")}>
          帳面へ戻す
        </button>
      </form>
    );
  }

  return (
    <form action={placeSlipAction} className="place-form">
      <input type="hidden" name="slipId" value={slipId} />
      <PlacePicker places={places} defaultPlaceId={defaultPlaceId} />
      <button type="submit" className="btn btn-ink" onClick={() => play("ink")} disabled={places.length === 0}>
        置く
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
