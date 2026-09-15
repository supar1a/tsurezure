"use client";

import { useActionState } from "react";
import { useSound } from "./sound-provider";
import type { FormState } from "@/app/actions/places";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function CreatePlaceForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, null);
  const { play } = useSound();

  return (
    <form action={formAction} className="leaf-section">
      <label className="field">
        <span className="field-label">スペース名</span>
        <input
          name="name"
          className="input"
          maxLength={32}
          required
          placeholder="たとえば「三人のところ」"
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
          作成する
        </button>
      </div>
    </form>
  );
}
