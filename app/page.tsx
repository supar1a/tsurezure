import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { kanjiDateShort, kanjiNumber } from "@/lib/kanji";
import { startAction } from "@/app/actions/identity";
import { Masthead } from "@/components/masthead";
import { PaperLink } from "@/components/paper-link";
import { GateMark } from "@/components/gate-mark";
import { DevSwitcher, StartForm } from "@/components/identity-forms";

export const metadata = { title: "つれづれ" };

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

  const places = await prisma.place.findMany({
    where: { memberships: { some: { userId: user.id } } },
    include: { _count: { select: { memberships: true } } },
    orderBy: { createdAt: "asc" },
  });

  const tallies = places.length
    ? await prisma.slip.groupBy({
        by: ["placeId"],
        where: { placeId: { in: places.map((p) => p.id) }, published: true },
        _count: { _all: true },
        _max: { createdAt: true },
      })
    : [];
  const tallyOf = new Map(tallies.map((t) => [t.placeId, t]));

  return (
    <div className="app">
      <Masthead sub={`${user.name} さん`}>
        <PaperLink href="/new" className="masthead-link" voice="rustle">
          グループを作る
        </PaperLink>
        <PaperLink href="/me" className="masthead-link" voice="rustle">
          あなたのページ
        </PaperLink>
      </Masthead>

      <div className="stage">
        <div className="scroll-tate">
          {places.length === 0 ? (
            <div className="hollow tate fade-in">
              <p>まだグループがありません。</p>
              <PaperLink href="/new" className="btn" voice="rustle">
                グループを作る
              </PaperLink>
            </div>
          ) : (
            <div className="stream tate fade-in">
              {/* 名前のもと。縦組みは右から読むので、いちばんはじめに置く。 */}
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
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
