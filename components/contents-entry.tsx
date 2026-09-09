import { kanjiDateShort } from "@/lib/kanji";
import { headingOf } from "@/lib/text";
import { PaperLink } from "./paper-link";
import type { SlipRow } from "./slip-column";

/**
 * 目次の一行。
 *
 * 縦組みでは、ひとつの塊がそのまま一行（一列）になる。
 * 題のすぐ下に、書いた人と日付が続く。小説の目次と同じ組み方。
 *
 * 押すと、その一篇の頁へ移る。
 */
export function ContentsEntry({
  slip,
  mine = false,
}: {
  slip: SlipRow;
  mine?: boolean;
}) {
  return (
    <PaperLink href={`/post/${slip.id}`} className="entry">
      <span className="entry-title">{headingOf(slip)}</span>

      <span className="entry-meta">
        {!slip.published ? <span className="seal">下書き</span> : null}
        {mine ? <span className="slip-mine">じぶん</span> : null}
        {slip.photo ? <span className="entry-mark">写</span> : null}
        <span>{slip.author.name}</span>
        <span className="slip-when">{kanjiDateShort(slip.createdAt)}</span>
      </span>
    </PaperLink>
  );
}
