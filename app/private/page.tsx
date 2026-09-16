import { requireUser } from "@/lib/auth";
import { Masthead } from "@/components/masthead";
import { OpenAt } from "@/components/open-at";
import { HeadAway } from "@/components/head-away";
import { DiaryColumn } from "@/components/slip-column";
import { ContentsEntry } from "@/components/contents-entry";
import { myNotebook } from "@/lib/guards";
import { PaperLink } from "@/components/paper-link";

export const metadata = { title: "ひとりのスペース" };

const SCROLLER = "scroller";

/**
 * ひとりのスペース。自分の書いたものが全部、ここに並ぶ。
 * 見せかたはスペースの頁と同じ：ふだんは目次、望めば巻物。
 * どこに投げたかに関わらず、書いたものはかならずここに残る。
 */
export default async function PrivatePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser();
  const slips = await myNotebook(user.id);
  const scroll = (await searchParams).view === "maki";

  return (
    <div className="app">
      <Masthead>
        <PaperLink href="/write" className="masthead-link" voice="rustle">
          書き散らす
        </PaperLink>
        <PaperLink
          href={scroll ? "/private" : "/private?view=maki"}
          className="masthead-link"
          voice="rustle"
        >
          {scroll ? "目次で見る" : "巻物で読む"}
        </PaperLink>
      </Masthead>

      <div className="stage">
        <div className="scroll-tate" id={SCROLLER}>
          {scroll ? (
            <div className="stream tate fade-in" data-stream>
              <h1 className="contents-title">ひとりのスペース</h1>

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

              {/* 巻物の左端。次の一枚が書かれる場所。 */}
              <PaperLink href="/write" className="blankpage" voice="rustle">
                <span className="btn btn-ink blankpage-btn">書き散らす</span>
              </PaperLink>
            </div>
          ) : (
            <div className="contents tate fade-in" data-stream>
              <h1 className="contents-title">ひとりのスペース</h1>

              {slips.length === 0 ? (
                <p className="waiting">
                  まだ何もありません。
                  <br />
                  いちばん最初の一枚をどうぞ。
                </p>
              ) : null}

              {/* 全部自分のものなので、名前も「じぶん」の印も出さない。題と日付だけ。 */}
              {slips.map((slip) => (
                <ContentsEntry key={slip.id} slip={slip} who={false} />
              ))}

              <PaperLink href="/write" className="blankpage" voice="rustle">
                <span className="btn btn-ink blankpage-btn">書き散らす</span>
              </PaperLink>
            </div>
          )}
        </div>

        <OpenAt edge="left" scrollerId={SCROLLER} />
      </div>

      <HeadAway />
    </div>
  );
}
