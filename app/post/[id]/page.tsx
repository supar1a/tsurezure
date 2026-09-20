import type { Metadata } from "next";
import { requireReadableSlip } from "@/lib/guards";
import { kanjiDate, kanjiTime } from "@/lib/kanji";
import { Masthead } from "@/components/masthead";
import { HeadAway } from "@/components/head-away";
import { OpenAt } from "@/components/open-at";
import { PaperLink } from "@/components/paper-link";
import { DeleteSlip, ShareControl } from "@/components/slip-actions";
import { ShareImage } from "@/components/share-image";
import { OpenControl } from "@/components/open-control";
import { Intro } from "@/components/intro";
import { StartForm } from "@/components/identity-forms";
import { startAction } from "@/app/actions/identity";
import { myPlaces } from "@/lib/guards";
import { SlipText } from "@/components/slip-column";
import { prisma } from "@/lib/db";
import { headingOf } from "@/lib/text";
import { card } from "@/lib/meta";

/*
 * 一篇の頁の名札には、ふだん何も出さない。
 *
 * 名札は名乗る前でも取りに来られる。LINE や Slack に貼れば、
 * その場の仕組みが名乗らずに読みにくる。中身はメンバーだけのものなので、
 * 題も本文も、どのスペースのものかも、ここには書かない。
 *
 * ただし、書いた本人が「リンクで公開」している一枚だけは、題（無ければ一行目）を出す。
 * その一枚は、URL を知っている人なら誰でも読めるものなので。スペースの名前は、それでも出さない。
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const slip = await prisma.slip.findUnique({ where: { id }, select: { open: true, title: true, body: true } });
  if (!slip?.open) return { title: { absolute: "つれづれ" } };
  const heading = headingOf(slip);
  return { title: heading, openGraph: card(`${heading} — つれづれ`) };
}

/**
 * 一篇の頁。頁は一つで、見ている人によって出すものを変える。
 *   ・書いた本人……編集・投稿先・公開・共有・削除
 *   ・スペースの仲間……柱にスペース名と「スペースへ戻る」
 *   ・外の人（リンクで公開中の一枚）……本文だけ。柱はロゴのみ。左に「つれづれとは」と、始める入口
 */
export default async function SlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, slip, isAuthor, through, outsider } = await requireReadableSlip(id);
  const places = isAuthor && user ? await myPlaces(user.id) : [];
  const sharedTo = slip.shares.map((s) => s.place);
  // 書いた本人には、どこに投げていようとひとりのスペースの一枚。ほかの人には、通ってきたスペースの一枚。
  const via = isAuthor ? null : through;

  return (
    <div className="app">
      {outsider ? (
        // 外の人には、どこの一枚かを出さない
        <Masthead />
      ) : (
        <Masthead sub={via?.name ?? "ひとりのスペース"}>
          {via ? (
            <PaperLink href={`/${via.slug}`} className="masthead-link">
              スペースへ戻る
            </PaperLink>
          ) : (
            <PaperLink href="/private" className="masthead-link">
              ひとりのスペースへ戻る
            </PaperLink>
          )}
        </Masthead>
      )}

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
              toggleId={isAuthor ? slip.id : undefined}
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
                <ShareControl slipId={slip.id} places={places} checked={sharedTo.map((p) => p.id)} />
                {/* リンクで公開。入れている間だけ、URL を知っている人なら誰でも本文だけ読める */}
                <OpenControl slipId={slip.id} open={slip.open} />
                {/* 縦書きの絵にして、端末の共有シートへ（Instagram のストーリーなど）。公開中なら URL も一緒に写す */}
                <ShareImage
                  slip={{ title: slip.title, body: slip.body, date: kanjiDate(slip.createdAt) }}
                  link={slip.open ? `/post/${slip.id}` : "/"}
                />
                <DeleteSlip slipId={slip.id} />
              </footer>
            ) : null}

            {/* 外から来た人へ。読み終えたさき（左）に、これが何かと、始める入口。一篇と同じ縦の流れに続ける */}
            {outsider ? (
              <div className="sheet-after">
                <Intro actions={!!user} />
                {!user ? (
                  <section className="landing-start">
                    <StartForm action={startAction} submit="ひとりではじめる" />
                    <p className="landing-note">友達と書きたいときは、あとからスペースを作れます。</p>
                  </section>
                ) : null}
              </div>
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
