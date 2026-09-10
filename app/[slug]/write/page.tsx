import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requirePlace } from "@/lib/guards";
import { writeSlipAction } from "@/app/actions/slips";
import { Masthead } from "@/components/masthead";
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
  return place ? { title: `書く — ${place.name}` } : {};
}

export default async function WritePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { place } = await requirePlace(slug);

  return (
    <div className="app">
      <Masthead sub={place.name}>
        <PaperLink href={`/${slug}`} className="masthead-link">
          やめる
        </PaperLink>
      </Masthead>

      <div className="stage fade-in">
        <Composer action={writeSlipAction} hidden={{ placeId: place.id }} />
      </div>
    </div>
  );
}
