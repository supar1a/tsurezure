import { PaperLink } from "./paper-link";
import { Logo } from "./logo";

export function Masthead({
  sub,
  subHref,
  children,
}: {
  sub?: string;
  /** 添え名そのものが戸口になるとき。品書きに同じ行き先を並べずに済む。 */
  subHref?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <header className="masthead">
        <PaperLink href="/" className="masthead-title">
          <Logo />
          <span className="sr-only">つれづれ</span>
        </PaperLink>
        {/* 本番でないところ（Vercel の Preview）には、ロゴの下に朱で印を押しておく */}
        {process.env.VERCEL_ENV === "preview" ? <span className="masthead-stage">Staging</span> : null}
        {sub && subHref ? (
          <PaperLink href={subHref} className="masthead-sub masthead-sub-link" voice="rustle">
            {sub}
          </PaperLink>
        ) : sub ? (
          <span className="masthead-sub">{sub}</span>
        ) : null}
        <nav className="masthead-nav">{children}</nav>
      </header>
      <div className="masthead-rule" />
    </>
  );
}
