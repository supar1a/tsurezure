import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { myPlaces, requirePlace } from "@/lib/guards";
import { writeSlipAction } from "@/app/actions/slips";
import { PaperLink } from "@/components/paper-link";
import { Composer } from "@/components/composer";

/* 名札。名前は URL を知っている人には元々見えているものだけ。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const place = await prisma.place.findUnique({ where: { slug }, select: { name: true } });
  return place ? { title: `書き散らす — ${place.name}` } : {};
}

export default async function WritePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, place } = await requirePlace(slug);
  const places = await myPlaces(user.id);

  // 書く頁には柱を立てない。表題も品書きも、書いているあいだは要らない。
  // 戻り道（やめる）は、釦の帯のなかに置く。
  return (
    <div className="app app-compose">
      <div className="stage fade-in">
        <Composer
          action={writeSlipAction}
          hidden={{ back: `/${slug}` }}
          places={places}
          defaultPlaceIds={[place.id]}
          cancel={
            <PaperLink href={`/${slug}`} className="btn btn-quiet" voice="rustle">
              やめる
            </PaperLink>
          }
        />
      </div>
    </div>
  );
}
