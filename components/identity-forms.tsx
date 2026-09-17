"use client";

import { useActionState } from "react";
import { useSound } from "./sound-provider";
import { becomeSomeoneAction, iAmAction } from "@/app/actions/identity";
import type { FormState } from "@/app/actions/identity";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * はじめまして。スペースを作るところから始める。
 * 名前だけ決めても行き先が無いので、名前はこの form のひとつとして聞く。
 */
export function StartForm({
  action,
  label = "あなたの名前",
  submit = "はじめる",
}: {
  action: Action;
  label?: string;
  submit?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const { play } = useSound();

  return (
    <form action={formAction} className="stack">
      <label className="field">
        <span className="field-label">{label}</span>
        <input
          name="name"
          className="input"
          maxLength={24}
          required
          autoFocus
          autoComplete="nickname"
          placeholder="例：工藤新一・しんいち・江戸川コナン"
        />
      </label>

      {state?.error ? <p className="notice">{state.error}</p> : null}

      <button
        type="submit"
        className="btn btn-ink btn-wide"
        disabled={pending}
        onClick={() => play("ink")}
      >
        {pending ? "…" : submit}
      </button>
    </form>
  );
}

/** 招待された URL から入るときは、名前だけでいい。 */
export function NameOnlyForm({
  action,
  hidden = {},
}: {
  action: Action;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const { play } = useSound();

  return (
    <form action={formAction} className="stack">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <label className="field">
        <span className="field-label">あなたの名前</span>
        <input
          name="name"
          className="input"
          maxLength={24}
          required
          autoFocus
          autoComplete="nickname"
          placeholder="例：工藤新一・しんいち・江戸川コナン"
        />
      </label>

      {state?.error ? <p className="notice">{state.error}</p> : null}

      <button
        type="submit"
        className="btn btn-ink btn-wide"
        disabled={pending}
        onClick={() => play("ink")}
      >
        {pending ? "…" : "参加する"}
      </button>
    </form>
  );
}

/** すでに名乗っている人が、そのままスペースに入る。 */
export function JoinAsMe({
  action,
  slug,
  name,
}: {
  action: Action;
  slug: string;
  name: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const { play } = useSound();

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="slug" value={slug} />
      {state?.error ? <p className="notice">{state.error}</p> : null}
      <button
        type="submit"
        className="btn btn-ink btn-wide"
        disabled={pending}
        onClick={() => play("ink")}
      >
        {name} として参加する
      </button>
    </form>
  );
}

/**
 * クッキーを失った人が、自分を選び直す。
 * すでに名乗っている人には出さない。
 */
export function PickMe({
  slug,
  people,
}: {
  slug: string;
  people: { id: string; name: string }[];
}) {
  const { play } = useSound();
  if (people.length === 0) return null;

  return (
    <div className="pickme">
      <p className="field-label">前に来たことがある方は、自分の名前を</p>
      <div className="pickme-people">
        {people.map((person) => (
          <form key={person.id} action={iAmAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="userId" value={person.id} />
            <button type="submit" className="btn" onClick={() => play("turn")}>
              {person.name}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}

/** 開発用の抜け道 */
export function DevSwitcher({ people }: { people: { id: string; name: string }[] }) {
  const { play } = useSound();

  return (
    <div className="debug">
      <p className="debug-label">開発用</p>
      <p className="debug-note">その人として見ます。本番では出ません。</p>
      {people.length === 0 ? (
        <p className="debug-note">
          まだ誰もいません。<code className="code">npm run seed</code> で種を蒔いてください。
        </p>
      ) : (
        <div className="debug-people">
          {people.map((person) => (
            <form key={person.id} action={becomeSomeoneAction}>
              <input type="hidden" name="userId" value={person.id} />
              <button type="submit" className="btn debug-btn" onClick={() => play("tick")}>
                {person.name}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}

export function RenameForm({ action, current }: { action: Action; current: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  const { play } = useSound();

  return (
    <form action={formAction} className="leaf-section">
      <label className="field">
        <span className="field-label">あなたの名前</span>
        <input
          name="name"
          className="input"
          maxLength={24}
          required
          defaultValue={current}
          autoComplete="nickname"
          placeholder="例：工藤新一・しんいち・江戸川コナン"
        />
      </label>

      {state?.error ? <p className="notice">{state.error}</p> : null}

      <div className="row">
        <button
          type="submit"
          className="btn btn-ink"
          disabled={pending}
          onClick={() => play("ink")}
        >
          保存する
        </button>
      </div>
    </form>
  );
}

export function Forget({ action }: { action: () => Promise<void> }) {
  const { play } = useSound();

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("この端末に保存されている名前を消します。よろしいですか。")) {
          event.preventDefault();
          return;
        }
        play("turn");
      }}
    >
      <button type="submit" className="btn" style={{ color: "var(--sumi-soft)" }}>
        ログアウト
      </button>
    </form>
  );
}
