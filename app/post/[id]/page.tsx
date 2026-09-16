import type { Metadata } from "next";
import { requireReadableSlip } from "@/lib/guards";
import { kanjiDate, kanjiTime } from "@/lib/kanji";
import { Masthead } from "@/components/masthead";
import { HeadAway } from "@/components/head-away";
import { OpenAt } from "@/components/open-at";
import { PaperLink } from "@/components/paper-link";
import { DeleteSlip, ShareControl } from "@/components/slip-actions";
import { myPlaces } from "@/lib/guards";
import { SlipText } from "@/components/slip-column";

/*
 * 一篇の頁には、何も出さない。
 *
 * 名札は名乗る前でも取りに来られる。LINE や Slack に貼れば、
 * その場の仕組みが名乗らずに読みにくる。中身はメンバーだけのものなので、
 * 題も本文も、どのスペースのものかも、ここには書かない。
 */
export const metadata: Metadata = { title: { absolute: "つれづれ" } };

export default async function SlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, slip, isAuthor, through } = await requireReadableSlip(id);
  const places = isAuthor ? await myPlaces(user.id) : [];
  const sharedTo = slip.shares.map((s) => s.place);
  // 書いた本人には、どこに投げていようとプライベートスペースの一枚。ほかの人には、通ってきたスペースの一枚。
  const via = isAuthor ? null : through;

  return (
    <div className="app">
      <Masthead sub={via?.name ?? "プライベートスペース"}>
        {via ? (
          <PaperLink href={`/${via.slug}`} className="masthead-link">
            スペースへ戻る
          </PaperLink>
        ) : (
          <PaperLink href="/private" className="masthead-link">
            プライベートスペースへ戻る
          </PaperLink>
        )}
      </Masthead>

      <div className="stage">
        <div className="scroll-tate">
          <article className="sheet tate fade-in" data-stream>
            <header className="sheet-head">
              {slip.title ? <h1 className="sheet-title">{slip.title}</h1> : null}

              {/* 名前と時刻は同じ一列に。題は題だけで立たせる。 */}
              <div className="sheet-byline">
                {via ? (
                  <PaperLink
                    href={`/${via.slug}/by/${slip.author.id}`}
                    className="sheet-who"
                    voice="rustle"
                  >
                    {slip.author.name}
                  </PaperLink>
                ) : (
                  <span className="sheet-who">{slip.author.name}</span>
                )}

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
                {/* いまの投稿先。ここでだけ、書いた本人にだけ。すぐ下の釦で変えられる。 */}
                <span className="sheet-shared">
                  {["プライベートスペース", ...sharedTo.map((p) => p.name)].join("・")}
                </span>
                <ShareControl slipId={slip.id} places={places} checked={sharedTo.map((p) => p.id)} />
                <DeleteSlip slipId={slip.id} />
              </footer>
            ) : null}
          </article>
        </div>
      </div>
      {/* 一篇は題から。右端（はじまり）でひらく。 */}
      <OpenAt edge="right" />
      <HeadAway />
    </div>
  );
}
