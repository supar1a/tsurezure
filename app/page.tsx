import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { startAction } from "@/app/actions/identity";
import { Masthead } from "@/components/masthead";
import { OpenAt } from "@/components/open-at";
import { kanjiDateShort, kanjiNumber } from "@/lib/kanji";
import { PaperLink } from "@/components/paper-link";
import { Intro, Epigraph } from "@/components/intro";
import { DevSwitcher, StartForm } from "@/components/identity-forms";

const isDev = process.env.NODE_ENV !== "production";

export default async function HomePage() {
  const user = await currentUser();

  // ── まだ誰でもない人。口上と、名乗る欄。門は別に立てず、同じトップで迎える。 ──
  if (!user) {
    const people = isDev
      ? await prisma.user.findMany({
          orderBy: { createdAt: "asc" },
          take: 8,
          select: { id: true, name: true },
        })
      : [];

    return (
      <div className="app">
        <Masthead />

        <OpenAt edge="right" />
        <div className="stage">
          <div className="scroll-tate">
            <div className="stream tate fade-in" data-stream>
              <Intro />

              <section className="welcome">
                <h2 className="panel-title">はじめまして</h2>
                <StartForm action={startAction} />
                <p className="caption">
                  アカウントはありません。
                  <br />
                  誰かに招待された方は、受け取った URL をひらいてください。
                </p>
                {isDev ? <DevSwitcher people={people} /> : null}
              </section>

              <Epigraph />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── トップ。書き散らす入口と、ひとりのスペース・スペースの札が並ぶ。 ──
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

  // ひとりのスペース。スペースではないが、投稿先としては同じ並びなので、先頭に置く。
  const mine = await prisma.slip.aggregate({
    where: { authorId: user.id },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  return (
    <div className="app">
      <Masthead>
        <PaperLink href="/write" className="masthead-link" voice="rustle">
          書き散らす
        </PaperLink>
        <PaperLink href="/me" className="masthead-link" voice="rustle">
          設定
        </PaperLink>
      </Masthead>

      <OpenAt edge="right" />
      <div className="stage">
        <div className="scroll-tate">
          <div className="stream tate fade-in" data-stream>
            <PaperLink href="/private" className="book book-self">
              <div className="book-head">
                <h2 className="book-name">ひとりのスペース</h2>
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

            {/* 札の並びの左に、これが何かを一息で。名乗った人には入口の釦も。 */}
            <Intro actions />

            <Epigraph />
          </div>
        </div>
      </div>
    </div>
  );
}
