import { PaperLink } from "./paper-link";

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
          つれづれ
        </PaperLink>
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
