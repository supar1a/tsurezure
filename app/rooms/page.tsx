import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { kanjiDateShort, kanjiNumber } from "@/lib/kanji";
import { Masthead } from "@/components/masthead";
import { OpenAt } from "@/components/open-at";
import { PaperLink } from "@/components/paper-link";

export const metadata = { title: "グループ" };

/** 入っているグループの一覧。日記を分かち合う先。 */
export default async function RoomsPage() {
  const user = await requireUser();

  const places = await prisma.place.findMany({
    where: { memberships: { some: { userId: user.id } } },
    include: { _count: { select: { memberships: true } } },
    orderBy: { createdAt: "asc" },
  });

  const tallies = places.length
    ? await prisma.share.groupBy({
        by: ["placeId"],
        where: { placeId: { in: places.map((p) => p.id) } },
        _count: { _all: true },
        _max: { createdAt: true },
      })
    : [];
  const tallyOf = new Map(tallies.map((t) => [t.placeId, t]));

  return (
    <div className="app">
      <Masthead sub="グループ">
        <PaperLink href="/new" className="masthead-link" voice="rustle">
          グループを作る
        </PaperLink>
      </Masthead>

      <OpenAt edge="right" />
      <div className="stage">
        <div className="scroll-tate">
          {places.length === 0 ? (
            <div className="hollow tate fade-in" data-stream>
              <p>まだグループがありません。</p>
              <PaperLink href="/new" className="btn" voice="rustle">
                グループを作る
              </PaperLink>
            </div>
          ) : (
            <div className="stream tate fade-in" data-stream>
              {places.map((place) => {
                const tally = tallyOf.get(place.id);
                const written = tally?._count._all ?? 0;
                const last = tally?._max.createdAt ?? null;

                return (
                  <PaperLink key={place.id} href={`/${place.slug}`} className="book">
                    <div className="book-head">
                      <h2 className="book-name">{place.name}</h2>
                      <div className="book-meta">
                        <span>{kanjiNumber(place._count.memberships)}人</span>
                        <span>{written > 0 ? `${kanjiNumber(written)}枚` : "まだ何もない"}</span>
                        {last ? <span>{kanjiDateShort(last)}</span> : null}
                      </div>
                    </div>
                  </PaperLink>
                );
              })}

              {/* 名前のもと。読み終えたさきに、奥付のように置く。
                  頭に置くと、狭い画面では序文だけで埋まってグループに手が届かない。 */}
              <div className="epigraph">
                {[
                  "つれづれなるままに、",
                  "日暮らし、硯に向かひて、",
                  "心にうつりゆくよしなしごとを、",
                  "そこはかとなく書きつくれば、",
                  "あやしうこそものぐるほしけれ。",
                ].map((line) => (
                  <p key={line} className="epigraph-text">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
