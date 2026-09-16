import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { startAction } from "@/app/actions/identity";
import { Masthead } from "@/components/masthead";
import { OpenAt } from "@/components/open-at";
import { kanjiDateShort, kanjiNumber } from "@/lib/kanji";
import { PaperLink } from "@/components/paper-link";
import { GateMark } from "@/components/gate-mark";
import { DevSwitcher, StartForm } from "@/components/identity-forms";

const isDev = process.env.NODE_ENV !== "production";

export default async function HomePage() {
  const user = await currentUser();

  // ── まだ誰でもない人。名前をひとつきくだけ。 ──
  if (!user) {
    const people = isDev
      ? await prisma.user.findMany({
          orderBy: { createdAt: "asc" },
          take: 8,
          select: { id: true, name: true },
        })
      : [];

    return (
      <main className="gate">
        <div className="gate-inner fade-in">
          <GateMark />
          <div className="gate-form">
            <p className="gate-heading">はじめまして</p>
            <StartForm action={startAction} />

            <p className="leaf-lede">
              アカウントはありません。
              <br />
              誰かに招待された方は、受け取った URL をひらいてください。
            </p>
            {isDev ? <DevSwitcher people={people} /> : null}
          </div>
        </div>
      </main>
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

            {/*
              札の並びの左に、これが何かを一息で。見出し → 説明 → 入口、の順。
            */}
            <section className="intro">
              {/* 巻いた紙にペン。縦組みの場に合わせて、見出しの右に添える。 */}
              <img src="/pen.png" alt="" className="intro-mark" width={186} height={155} />

              <h1 className="intro-title">思いついたまま、書き散らす。</h1>

              <div className="intro-lede">
                <p className="intro-text">
                  つれづれは、日々のことや、ふと思ったことを、
                  <br />
                  縦書きで残しておける場所です。
                </p>
                <p className="intro-text">
                  基本は、自分だけのために。
                  <br />
                  誰かと残したいときは、スペースをつくって友達と共有できます。
                </p>
                <p className="intro-text">いいねも、フォロワーもありません。</p>
              </div>

              <div className="intro-actions">
                <PaperLink href="/write" className="btn btn-ink" voice="rustle">
                  書き散らす
                </PaperLink>
                <PaperLink href="/new" className="btn" voice="rustle">
                  スペースを作る
                </PaperLink>
              </div>
            </section>

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
