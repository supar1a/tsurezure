import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requirePlace } from "@/lib/guards";
import { kanjiDateShort } from "@/lib/kanji";
import { Masthead } from "@/components/masthead";
import { PaperLink } from "@/components/paper-link";
import { InviteUrl, LeavePlace, RemoveMember, RenamePlace } from "@/components/place-admin";

export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, place, membership } = await requirePlace(slug);
  const isOwner = membership.role === "owner";

  const head = await headers();
  const proto = head.get("x-forwarded-proto") ?? "http";
  const host = head.get("host") ?? "localhost:3000";
  const inviteUrl = `${proto}://${host}/${place.slug}`;

  const members = await prisma.membership.findMany({
    where: { placeId: place.id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <div className="app">
      <Masthead sub={place.name}>
        <PaperLink href={`/${slug}`} className="masthead-link">
          グループへ戻る
        </PaperLink>
      </Masthead>

      <div className="stage">
        <div className="scroll-tate">
          <div className="roster tate fade-in">
            <section className="panel">
              <h1 className="panel-title">招待する</h1>
              <InviteUrl url={inviteUrl} />
              <p className="caption">
                この URL を渡した人が入れます。ひらくと名前をきかれて、そのまま仲間になります。
              </p>
              {!isOwner ? <LeavePlace placeId={place.id} /> : null}
            </section>

            {isOwner ? (
              <section className="panel">
                <h1 className="panel-title">グループの名前</h1>
                <p className="caption">付けなおしても、招待 URL は変わりません。</p>
                <RenamePlace placeId={place.id} current={place.name} />
              </section>
            ) : null}

            {members.map((member) => {
              const isMe = member.userId === user.id;

              return (
                <div key={member.id} className="person">
                  <PaperLink
                    href={`/${slug}/by/${member.userId}`}
                    className="person-name slip-who"
                    voice="rustle"
                  >
                    {member.user.name}
                    {isMe ? "（自分）" : ""}
                  </PaperLink>

                  <span className="person-role">
                    {member.role === "owner" ? "作成者" : "メンバー"}
                  </span>
                  <span className="person-role">{kanjiDateShort(member.joinedAt)}から</span>

                  {isOwner && !isMe && member.role !== "owner" ? (
                    <RemoveMember
                      placeId={place.id}
                      userId={member.userId}
                      name={member.user.name}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
