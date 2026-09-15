import { notFound } from "next/navigation";
import { myPlaces, requireReadableSlip } from "@/lib/guards";
import { saveSlipAction } from "@/app/actions/slips";
import { PaperLink } from "@/components/paper-link";
import { Composer } from "@/components/composer";
import { splitAroundPhoto } from "@/lib/text";

export const metadata = { title: "編集" };

export default async function EditSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, slip, isAuthor } = await requireReadableSlip(id);
  if (!isAuthor) notFound();
  const places = await myPlaces(user.id);

  const { before, after } = slip.photo
    ? splitAroundPhoto(slip.body)
    : { before: slip.body, after: "" };

  // 書く頁と同じく、柱は立てない。やめれば一篇の頁へ戻る。
  return (
    <div className="app app-compose">
      <div className="stage fade-in">
        <Composer
          action={saveSlipAction}
          hidden={{ slipId: slip.id }}
          defaultTitle={slip.title ?? ""}
          defaultBefore={before}
          defaultAfter={after}
          defaultPhoto={slip.photo}
          published={true}
          places={places}
          defaultPlaceIds={slip.shares.map((s) => s.place.id)}
          cancel={
            <PaperLink href={`/post/${slip.id}`} className="btn btn-quiet" voice="rustle">
              やめる
            </PaperLink>
          }
        />
      </div>
    </div>
  );
}
