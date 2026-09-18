import { PaperLink } from "./paper-link";

/**
 * つれづれとは。細い枠で囲った一枚の札。
 *
 * 右から、小さく「つれづれとは」、大きな見出し、本文、そして左に戸口の釦（書き散らす・スペースを作る）。
 * 全部縦組み。宿の案内板のような組み。
 * トップに来た人みんなに見せる。名乗る前の人にはこれが口上、名乗った人には札の並びの左の添え。
 * 戸口は名乗った人にだけ。名乗る前は、この札の左に名乗る欄が続く。
 */
export function Intro({ actions = false }: { actions?: boolean }) {
  return (
    <section className="about">
      <header className="about-head">
        <p className="about-kicker">つれづれとは</p>
        <h1 className="about-title">思いつくまま、書き散らす。</h1>
      </header>

      <div className="about-body">
        <p className="about-text">
          日々のことや、ふと思ったことを、
          <br />
          縦書きで残しておける場所です。
        </p>
        <p className="about-text">ひとりでも、友達とも。</p>

        {/* 紙に向かって書く人の絵。本文の左に */}
        <img src="/dance.png" alt="" className="about-mark" width={246} height={260} />

        {/* 戸口は本文と同じ縦の流れの末尾（左）に、下に寄せて置く。別の段にすると本文の丈が足りなくなる。 */}
        {actions ? (
          <footer className="about-foot">
            <PaperLink href="/write" className="btn btn-ink" voice="rustle">
              書き散らす
            </PaperLink>
            <PaperLink href="/new" className="btn" voice="rustle">
              スペースを作る
            </PaperLink>
          </footer>
        ) : null}
      </div>
    </section>
  );
}
