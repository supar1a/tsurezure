import { requireUser } from "@/lib/auth";
import { Masthead } from "@/components/masthead";
import { OpenAt } from "@/components/open-at";
import { HeadAway } from "@/components/head-away";
import { DiaryColumn } from "@/components/slip-column";
import { myNotebook } from "@/lib/guards";
import { PaperLink } from "@/components/paper-link";

export const metadata = { title: "ひとりのスペース" };

/**
 * ひとりのスペース。自分の書いたものが全部、巻物で並ぶ。左端がいちばん新しい。
 * どこに投げたかに関わらず、書いたものはかならずここに残る。
 */
export default async function PrivatePage() {
  const user = await requireUser();
  const slips = await myNotebook(user.id);

  return (
    <div className="app">
      {/* 柱の添え名は「いまどこに居るか」。品書きは、ここでできること → 隣の場所、の順。 */}
      <Masthead sub="ひとりのスペース">
        <PaperLink href="/write" className="masthead-link" voice="rustle">
          書き散らす
        </PaperLink>
        <PaperLink href="/" className="masthead-link" voice="rustle">
          トップ
        </PaperLink>
      </Masthead>

      <div className="stage">
        <div className="scroll-tate" id="scroller">
          <div className="stream tate fade-in" data-stream>
            {slips.length === 0 ? (
              <p className="waiting">
                まだ何もありません。
                <br />
                いちばん最初の一枚をどうぞ。
              </p>
            ) : null}

            {slips.map((slip) => (
              <DiaryColumn key={slip.id} slip={slip} />
            ))}

            {/* 巻物の左端。次の一枚が書かれる場所。押せると分かるように、投稿するのと同じ墨の釦にする。 */}
            <PaperLink href="/write" className="blankpage" voice="rustle">
              <span className="btn btn-ink blankpage-btn">書き散らす</span>
            </PaperLink>
          </div>
        </div>

        <OpenAt edge="left" scrollerId="scroller" />
      </div>

      <HeadAway />
    </div>
  );
}
