import { notFound } from "next/navigation";
import { requireReadableSlip } from "@/lib/guards";
import { saveSlipAction } from "@/app/actions/slips";
import { Masthead } from "@/components/masthead";
import { PaperLink } from "@/components/paper-link";
import { Composer } from "@/components/composer";
import { splitAroundPhoto } from "@/lib/text";

export const metadata = { title: "編集 — つれづれ" };

export default async function EditSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { slip, isAuthor } = await requireReadableSlip(id);
  if (!isAuthor) notFound();

  const { before, after } = slip.photo
    ? splitAroundPhoto(slip.body)
    : { before: slip.body, after: "" };

  return (
    <div className="app">
      <Masthead sub={slip.place.name}>
        <PaperLink href={`/post/${slip.id}`} className="masthead-link">
          やめる
        </PaperLink>
      </Masthead>

      <div className="stage fade-in">
        <Composer
          action={saveSlipAction}
          hidden={{ slipId: slip.id }}
          defaultTitle={slip.title ?? ""}
          defaultBefore={before}
          defaultAfter={after}
          defaultPhoto={slip.photo}
          published={slip.published}
        />
      </div>
    </div>
  );
}
