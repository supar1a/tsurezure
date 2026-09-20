import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { startAction } from "@/app/actions/identity";
import { Masthead } from "@/components/masthead";
import { OpenAt } from "@/components/open-at";
import { kanjiDateShort, kanjiNumber } from "@/lib/kanji";
import { PaperLink } from "@/components/paper-link";
import { Intro } from "@/components/intro";
import { DevSwitcher, StartForm } from "@/components/identity-forms";
import { SITE, card } from "@/lib/meta";

const isDev = process.env.NODE_ENV !== "production";

/*
 * 戸口だけは、探しものに載せる。ここに出ているのは口上と名乗る欄だけで、
 * 誰かの書いたものは何も無い。スペースも一篇も、これまで通り載せない（app/layout.tsx で断っている）。
 */
export const metadata = {
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: "/" },
  openGraph: card(SITE, "https://tsurezure.site/"),
};

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
              {/* まず名乗る欄。ここから始められる。 */}
              <section className="landing-start">
                <StartForm action={startAction} submit="ひとりではじめる" />
                <p className="landing-note">友達と書きたいときは、あとからスペースを作れます。</p>
                {isDev ? <DevSwitcher people={people} /> : null}
              </section>

              {/* 招待の塊：名乗る欄から離して、控えめに。 */}
              <aside className="landing-invite">
                <h2 className="panel-title">招待されていますか？</h2>
                <p className="caption">
                  届いた URL をひらくと、そのスペースに参加できます。
                  <br />
                  アカウント登録は必要ありません。
                </p>
              </aside>

              {/* つれづれとは。読み終えたさき（左端）に、枠で囲った一枚の札。 */}
              <Intro />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── トップ。書き散らす入口と、ひとりのスペース・スペースの札が並ぶ。 ──
  const places = await prisma.place.findMany({
    where: { memberships: { some: { userId: user.id } } },
    include: {
      _count: { select: { memberships: true } },
      memberships: { where: { userId: user.id }, select: { lastReadAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  /*
   * 新しいものがあるか。最後に見た時刻より後に、ほかの人が投げていれば付ける。
   * 数は出さない（数えないのがこの場の性格）。自分の投稿では付けない。まだ一度も見ていない札にも付けない。
   */
  const fresh = new Set<string>();
  for (const place of places) {
    const seen = place.memberships[0]?.lastReadAt;
    if (!seen) continue;
    const newer = await prisma.share.findFirst({
      where: { placeId: place.id, createdAt: { gt: seen }, slip: { authorId: { not: user.id } } },
      select: { slipId: true },
    });
    if (newer) fresh.add(place.id);
  }

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
                    <h2 className="book-name">
                      {fresh.has(place.id) ? (
                        <span className="book-fresh" title="新しいものがあります">
                          <span className="sr-only">新しいものがあります</span>
                        </span>
                      ) : null}
                      {place.name}
                    </h2>
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
          </div>
        </div>
      </div>
    </div>
  );
}
