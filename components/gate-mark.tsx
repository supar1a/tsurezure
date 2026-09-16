import { Logo } from "./logo";

export function GateMark() {
  return (
    <div className="gate-mark">
      <h1 className="gate-mark-title">
        <Logo />
        <span className="sr-only">つれづれ</span>
      </h1>
      <p className="gate-mark-note">
        自分と友達だけの、
        <br />
        縦書きの書き散らし。
      </p>
    </div>
  );
}
