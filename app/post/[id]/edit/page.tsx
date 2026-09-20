import { notFound } from "next/navigation";
import { myPlaces, requireReadableSlip } from "@/lib/guards";
import { saveSlipAction } from "@/app/actions/slips";
import { Composer } from "@/components/composer";
import { splitAroundPhoto } from "@/lib/text";

export const metadata = { title: "編集" };

export default async function EditSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, slip, isAuthor } = await requireReadableSlip(id);
  // 直せるのは書いた本人だけ（公開中の一枚を外の人がひらいても、ここには入れない）
  if (!isAuthor || !user) notFound();
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
          cancelHref={`/post/${slip.id}`}
        />
      </div>
    </div>
  );
}
