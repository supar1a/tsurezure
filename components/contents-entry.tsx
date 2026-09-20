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
  who = true,
}: {
  slip: SlipRow;
  /** 書いた人の名前を出すか。ひとりのスペースでは全部自分なので出さない。 */
  who?: boolean;
}) {
  return (
    <PaperLink href={`/post/${slip.id}`} className="entry">
      <span className="entry-title">{headingOf(slip)}</span>

      <span className="entry-meta">
        {slip.photo ? <span className="entry-mark">写</span> : null}
        {who ? <span>{slip.author.name}</span> : null}
        <span className="slip-when">{kanjiDateShort(slip.createdAt)}</span>
      </span>
    </PaperLink>
  );
}
