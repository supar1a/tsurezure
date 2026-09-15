import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { startAction } from "@/app/actions/identity";
import { Masthead } from "@/components/masthead";
import { OpenAt } from "@/components/open-at";
import { HeadAway } from "@/components/head-away";
import { DiaryColumn } from "@/components/slip-column";
import { myNotebook } from "@/lib/guards";
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

  // ── 日記。自分の書いたものが、巻物で並ぶ。左端がいちばん新しい。 ──
  const slips = await myNotebook(user.id);

  return (
    <div className="app">
      {/* 名乗りそのものが、あなたのページへの戸口。品書きに同じ行き先は並べない。 */}
      <Masthead sub={`${user.name} さん`} subHref="/me">
        <PaperLink href="/write" className="masthead-link" voice="rustle">
          書く
        </PaperLink>
        <PaperLink href="/rooms" className="masthead-link" voice="rustle">
          グループ
        </PaperLink>
      </Masthead>

      <div className="stage">
        <div className="scroll-tate" id="scroller">
          <div className="stream tate fade-in" data-stream>
            {slips.length === 0 ? (
              <p className="waiting">
                まだ何もありません。
                <br />
                いちばん最初の一枚をどうぞ。
              </p>
            ) : (
              <p className="stream-end">ここが、はじまり</p>
            )}

            {slips.map((slip) => (
              <DiaryColumn key={slip.id} slip={slip} />
            ))}

            {/* 巻物の左端。次の一枚が書かれる場所。 */}
            <PaperLink href="/write" className="blankpage" voice="rustle">
              <span className="blankpage-lede">書く</span>
              <span className="blankpage-hint">
                なんでもいい。
                <br />
                整っていなくていい。
              </span>
            </PaperLink>
          </div>
        </div>

        <OpenAt edge="left" scrollerId="scroller" />
      </div>

      <HeadAway />
    </div>
  );
}
