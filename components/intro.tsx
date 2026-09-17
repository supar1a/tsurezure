import { PaperLink } from "./paper-link";

/**
 * これが何かを一息で。絵、見出し、概要。
 *
 * トップに来た人みんなに見せる。まだ名乗っていない人にはこれが戸口の口上になり、
 * 名乗った人には札の並びの左に添え書きとして残る。
 * 釦（書き散らす・スペースを作る）は名乗った人にだけ。名乗る前は、名乗る欄がその役目。
 */
export function Intro({ actions = false }: { actions?: boolean }) {
  return (
    <section className="intro">
      <img src="/dance.png" alt="" className="intro-mark" width={246} height={260} />

      <h1 className="intro-title">思いついたまま、書き散らす。</h1>

      <div className="intro-lede">
        <p className="intro-text">
          つれづれは、日々のことや、ふと思ったことを、
          <br />
          縦書きで残しておける場所です。
        </p>
        <p className="intro-text">
          基本は、自分だけのために。
          <br />
          誰かと残したいときは、スペースをつくって友達と共有できます。
        </p>
        <p className="intro-text">いいねも、フォロワーもありません。</p>
      </div>

      {actions ? (
        <div className="intro-actions">
          <PaperLink href="/write" className="btn btn-ink" voice="rustle">
            書き散らす
          </PaperLink>
          <PaperLink href="/new" className="btn" voice="rustle">
            スペースを作る
          </PaperLink>
        </div>
      ) : null}
    </section>
  );
}
