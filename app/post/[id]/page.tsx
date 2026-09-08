import { requireReadableSlip } from "@/lib/guards";
import { kanjiDate, kanjiTime } from "@/lib/kanji";
import { Masthead } from "@/components/masthead";
import { PaperLink } from "@/components/paper-link";
import { DeleteSlip, PublishToggle } from "@/components/slip-actions";
import { SlipText } from "@/components/slip-column";

export default async function SlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { slip, isAuthor } = await requireReadableSlip(id);

  return (
    <div className="app">
      <Masthead sub={slip.place.name}>
        {isAuthor ? (
          <>
            <PaperLink href={`/post/${slip.id}/edit`} className="masthead-link" voice="rustle">
              編集
            </PaperLink>
            <PublishToggle slipId={slip.id} published={slip.published} />
            <DeleteSlip slipId={slip.id} />
          </>
        ) : null}
        <PaperLink href={`/${slip.place.slug}`} className="masthead-link">
          グループへ戻る
        </PaperLink>
      </Masthead>

      <div className="stage">
        <div className="scroll-tate">
          <article className="sheet tate fade-in">
            <header className="sheet-head">
              <div className="sheet-head-lead">
                {slip.title ? <h1 className="sheet-title">{slip.title}</h1> : null}
                <PaperLink
                  href={`/${slip.place.slug}/by/${slip.author.id}`}
                  className="sheet-who"
                  voice="rustle"
                >
                  {slip.author.name}
                </PaperLink>
              </div>
              <div className="sheet-byline">
                {!slip.published ? <span className="seal">下書き</span> : null}
                <span>{kanjiDate(slip.createdAt)}</span>
                <span>{kanjiTime(slip.createdAt)}</span>
              </div>
            </header>

            <SlipText
              body={slip.body}
              photo={slip.photo}
              bodyClassName="sheet-body"
              photoClassName="sheet-photo"
            />
          </article>
        </div>
      </div>
    </div>
  );
}
