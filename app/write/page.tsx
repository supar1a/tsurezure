import { requireUser } from "@/lib/auth";
import { myPlaces } from "@/lib/guards";
import { writeSlipAction } from "@/app/actions/slips";
import { PaperLink } from "@/components/paper-link";
import { Composer } from "@/components/composer";

export const metadata = { title: "書く" };

/**
 * 部屋の外から書く。書いたものはまず日記（自分だけ）に入り、「置く」で部屋に出る。
 * 柱は立てない（書く頁と同じ）。やめれば日記へ戻る。
 */
export default async function WritePage() {
  const user = await requireUser();
  const places = await myPlaces(user.id);

  return (
    <div className="app app-compose">
      <div className="stage fade-in">
        <Composer
          action={writeSlipAction}
          hidden={{ back: "/" }}
          places={places}
          defaultPlaceId={user.defaultPlaceId}
          cancel={
            <PaperLink href="/" className="btn btn-quiet" voice="rustle">
              やめる
            </PaperLink>
          }
        />
      </div>
    </div>
  );
}
