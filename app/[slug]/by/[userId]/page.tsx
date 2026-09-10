import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePlace, readableSlips } from "@/lib/guards";
import { Masthead } from "@/components/masthead";
import { PaperLink } from "@/components/paper-link";
import { SlipColumn } from "@/components/slip-column";
import { OpenAtLatest } from "@/components/open-at-latest";

/** その人が書いたものだけを続けて読む。相手を少し知るための入口。 */
/* 名札。名前は URL を知っている人には元々見えているものだけ。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>;
}): Promise<Metadata> {
  const { slug, userId } = await params;
  const [place, who] = await Promise.all([
    prisma.place.findUnique({ where: { slug }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  if (!place || !who) return {};
  return { title: `${who.name}さん — ${place.name}` };
}

export default async function ByPersonPage({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>;
}) {
  const { slug, userId } = await params;
  const { user, place } = await requirePlace(slug);

  const theirs = await prisma.membership.findUnique({
    where: { userId_placeId: { userId, placeId: place.id } },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!theirs) notFound();

  const slips = await readableSlips(place.id, user.id, { authorId: userId });
  const name = theirs.user.name ?? "名もなき人";

  return (
    <div className="app">
      <Masthead sub={`${place.name}　${name}さん`}>
        <PaperLink href={`/${slug}`} className="masthead-link">
          グループへ戻る
        </PaperLink>
      </Masthead>

      <div className="stage">
        <div className="scroll-tate" id="scroller">
          <div className="stream tate fade-in" data-stream>
            {slips.length === 0 ? (
              <p className="waiting">{name}さんは、まだ何も書いていません。</p>
            ) : (
              slips.map((slip) => (
                <SlipColumn
                  key={slip.id}
                  slip={slip}
                  slug={slug}
                  mine={slip.author.id === user.id}
                />
              ))
            )}
          </div>
        </div>

        <OpenAtLatest scrollerId="scroller" />
      </div>
    </div>
  );
}
