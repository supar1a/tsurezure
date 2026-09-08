import { requirePlace } from "@/lib/guards";
import { writeSlipAction } from "@/app/actions/slips";
import { Masthead } from "@/components/masthead";
import { PaperLink } from "@/components/paper-link";
import { Composer } from "@/components/composer";

export const metadata = { title: "書く — つれづれ" };

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
