import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { kanjiDateShort, kanjiNumber } from "@/lib/kanji";
import { Masthead } from "@/components/masthead";
import { OpenAt } from "@/components/open-at";
import { PaperLink } from "@/components/paper-link";

export const metadata = { title: "スペース" };

/** 入っているスペースの一覧。プライベートスペースを分かち合う先。 */
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

  // プライベートスペース（プライベートスペース）。スペースではないが、投稿先としては同じ並びなので、先頭に置く。
  const mine = await prisma.slip.aggregate({
    where: { authorId: user.id },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  return (
    <div className="app">
      <Masthead sub="スペース">
        <PaperLink href="/new" className="masthead-link" voice="rustle">
          スペースを作る
        </PaperLink>
      </Masthead>

      <OpenAt edge="right" />
      <div className="stage">
        <div className="scroll-tate">
            <div className="stream tate fade-in" data-stream>
              <PaperLink href="/" className="book book-self">
                <div className="book-head">
                  {/* 朱の印。巻物で自分の一枚に「じぶん」が付くのと同じ印。 */}
                  <span className="seal book-seal">じぶん</span>
                  <h2 className="book-name">プライベートスペース</h2>
                  <div className="book-meta">
                    <span>
                      {mine._count._all > 0 ? `${kanjiNumber(mine._count._all)}枚` : "まだ何もない"}
                    </span>
                    {mine._max.createdAt ? <span>{kanjiDateShort(mine._max.createdAt)}</span> : null}
                  </div>
                </div>
              </PaperLink>

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
                  頭に置くと、狭い画面では序文だけで埋まってスペースに手が届かない。 */}
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
        </div>
      </div>

    </div>
  );
}
