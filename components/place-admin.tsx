"use client";

import { useActionState, useState } from "react";
import { useSound } from "./sound-provider";
import { leavePlaceAction, removeMemberAction, renamePlaceAction } from "@/app/actions/places";
import { PLACE_NAME_MAX } from "@/lib/text";

/**
 * グループの名前を付けなおす。
 *
 * 名前だけが変わる。URL（合鍵）はそのままなので、渡してある招待状は切れない。
 */
export function RenamePlace({ placeId, current }: { placeId: string; current: string }) {
  const [state, formAction, pending] = useActionState(renamePlaceAction, null);
  const { play } = useSound();

  return (
    <form action={formAction} className="leaf-section">
      <input type="hidden" name="placeId" value={placeId} />

      <label className="field">
        <span className="field-label">グループ名</span>
        <input
          name="name"
          className="input"
          maxLength={PLACE_NAME_MAX}
          required
          defaultValue={current}
        />
      </label>

      {state?.error ? <p className="notice">{state.error}</p> : null}

      <div className="row">
        <button
          type="submit"
          className="btn"
          disabled={pending}
          onClick={() => play("ink")}
        >
          保存する
        </button>
      </div>
    </form>
  );
}

/** 招待 URL。これを渡すことが、そのまま招待になる。 */
export function InviteUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const { play } = useSound();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      play("tick");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // クリップボードが使えない環境では、目で読んで写してもらう
    }
  }

  return (
    <div className="invite">
      <p className="invite-url">{url}</p>
      <button type="button" className="btn btn-ink" onClick={copy}>
        {copied ? "コピーしました" : "URL をコピー"}
      </button>
    </div>
  );
}

export function RemoveMember({
  placeId,
  userId,
  name,
}: {
  placeId: string;
  userId: string;
  name: string;
}) {
  const { play } = useSound();

  return (
    <form
      action={removeMemberAction}
      onSubmit={(event) => {
        if (!window.confirm(`${name}さんをこのグループから外します。`)) {
          event.preventDefault();
          return;
        }
        play("rustle");
      }}
    >
      <input type="hidden" name="placeId" value={placeId} />
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className="btn btn-quiet"
        style={{ fontSize: "0.7rem", color: "var(--sumi-ghost)" }}
      >
        外す
      </button>
    </form>
  );
}

export function LeavePlace({ placeId }: { placeId: string }) {
  const { play } = useSound();

  return (
    <form
      action={leavePlaceAction}
      onSubmit={(event) => {
        if (!window.confirm("このグループを抜けます。書いたものは残ります。")) {
          event.preventDefault();
          return;
        }
        play("turn");
      }}
    >
      <input type="hidden" name="placeId" value={placeId} />
      <button
        type="submit"
        className="btn btn-quiet"
        style={{ fontSize: "0.72rem", color: "var(--sumi-ghost)" }}
      >
        グループを抜ける
      </button>
    </form>
  );
}
