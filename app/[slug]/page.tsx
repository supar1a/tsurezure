import type { Metadata } from "next";
import { Fragment } from "react";
import { openPlace, readableSlips } from "@/lib/guards";
import { unreadMarkAt } from "@/lib/place";
import { prisma } from "@/lib/db";
import { SITE, card } from "@/lib/meta";
import { joinAction } from "@/app/actions/identity";
import { Masthead } from "@/components/masthead";
import { PaperLink } from "@/components/paper-link";
import { SlipColumn } from "@/components/slip-column";
import { ContentsEntry } from "@/components/contents-entry";
import { MarkAsRead } from "@/components/mark-as-read";
import { OpenAtLatest } from "@/components/open-at-latest";
import { GateMark } from "@/components/gate-mark";
import { JoinAsMe, NameOnlyForm, PickMe } from "@/components/identity-forms";

const SCROLLER = "scroller";

/*
 * 分かち合うときに出る名札。
 *
 * グループの名前は、URL を知っている人には元々見せているので出してよい。
 * 中身（誰が何を書いたか）は出さない。名札は名乗る前でも取りに来られるので、
 * ここに書いたものは URL を受け取った人みんなに見えることになる。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const place = await prisma.place.findUnique({ where: { slug }, select: { name: true } });
  if (!place) return {};
  return {
    title: place.name,
    openGraph: card(`${place.name} — ${SITE}`),
  };
}

export default async function PlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { slug } = await params;
  const { user, place, membership } = await openPlace(slug);

  // ── この URL が招待状。まだ中にいない人には、まず名乗ってもらう。 ──
  if (!membership) {
    const members = await prisma.membership.findMany({
      where: { placeId: place.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "asc" },
    });

    return (
      <main className="gate">
        <div className="gate-inner fade-in">
          <GateMark />
          <div className="gate-form">
            <p className="gate-heading">{place.name}</p>

            {user ? (
              <JoinAsMe action={joinAction} slug={slug} name={user.name} />
            ) : (
              <>
                <p className="leaf-lede">
                  このグループに招待されています。
                  <br />
                  呼ばれたい名前をひとつ、決めてください。
                </p>
                <NameOnlyForm action={joinAction} hidden={{ slug }} />
                <PickMe
                  slug={slug}
                  people={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
                />
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  // 古い順。縦組みでは、右から左へ流れる向きになる。
  const slips = await readableSlips(place.id, user!.id);
  const unreadAt = unreadMarkAt(slips, membership.lastReadAt);
  const scroll = (await searchParams).view === "maki";

  return (
    <div className="app">
      <Masthead sub={place.name}>
        <PaperLink href={`/${slug}/write`} className="masthead-link" voice="rustle">
          書く
        </PaperLink>
        <PaperLink
          href={scroll ? `/${slug}` : `/${slug}?view=maki`}
          className="masthead-link"
          voice="rustle"
        >
          {scroll ? "目次で見る" : "巻物で読む"}
        </PaperLink>
        <PaperLink href={`/${slug}/members`} className="masthead-link" voice="rustle">
          このグループ
        </PaperLink>
      </Masthead>

      <div className="stage">
        <div className="scroll-tate" id={SCROLLER}>
          {scroll ? (
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

              {slips.map((slip, index) => (
                <Fragment key={slip.id}>
                  {index === unreadAt ? (
                    <div className="unread-mark">
                      <span className="unread-mark-label">ここから未読</span>
                    </div>
                  ) : null}
                  <SlipColumn slip={slip} slug={slug} mine={slip.author.id === user!.id} />
                </Fragment>
              ))}

              {/* 巻物の左端。次の一枚が書かれる場所。 */}
              <PaperLink href={`/${slug}/write`} className="blankpage" voice="rustle">
                <span className="blankpage-lede">書く</span>
                <span className="blankpage-hint">
                  なんでもいい。
                  <br />
                  整っていなくていい。
                </span>
              </PaperLink>
            </div>
          ) : (
            <div className="contents tate fade-in" data-stream>
              <h1 className="contents-title">{place.name}</h1>

              {slips.length === 0 ? (
                <p className="waiting">
                  まだ何もありません。
                  <br />
                  いちばん最初の一枚をどうぞ。
                </p>
              ) : null}

              {slips.map((slip, index) => (
                <Fragment key={slip.id}>
                  {index === unreadAt ? (
                    <div className="unread-mark">
                      <span className="unread-mark-label">ここから未読</span>
                    </div>
                  ) : null}
                  <ContentsEntry slip={slip} mine={slip.author.id === user!.id} />
                </Fragment>
              ))}
            </div>
          )}
        </div>

        <OpenAtLatest scrollerId={SCROLLER} />
      </div>

      <MarkAsRead placeId={place.id} />
    </div>
  );
}
