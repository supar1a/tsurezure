import type { Metadata } from "next";
import { requireReadableSlip } from "@/lib/guards";
import { kanjiDate, kanjiTime } from "@/lib/kanji";
import { Masthead } from "@/components/masthead";
import { PaperLink } from "@/components/paper-link";
import { DeleteSlip, PublishToggle } from "@/components/slip-actions";
import { SlipText } from "@/components/slip-column";

/*
 * 一篇の頁には、何も出さない。
 *
 * 名札は名乗る前でも取りに来られる。LINE や Slack に貼れば、
 * その場の仕組みが名乗らずに読みにくる。中身はメンバーだけのものなので、
 * 題も本文も、どのグループのものかも、ここには書かない。
 */
export const metadata: Metadata = { title: { absolute: "つれづれ" } };

export default async function SlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { slip, isAuthor } = await requireReadableSlip(id);

  return (
    <div className="app">
      <Masthead sub={slip.place.name}>
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

            {/*
              この一篇にできること。読み終えた先——縦組みではいちばん左——に置く。
              柱は「いまどこに居るか」を示すもので、選んだ物への操作の場ではない。
            */}
            {isAuthor ? (
              <footer className="sheet-foot">
                <PaperLink href={`/post/${slip.id}/edit`} className="btn" voice="rustle">
                  編集
                </PaperLink>
                <PublishToggle slipId={slip.id} published={slip.published} />
                <DeleteSlip slipId={slip.id} />
              </footer>
            ) : null}
          </article>
        </div>
      </div>
    </div>
  );
}
