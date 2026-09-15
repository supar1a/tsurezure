import { requireUser } from "@/lib/auth";
import { myNotebook } from "@/lib/guards";
import { headingOf } from "@/lib/text";
import { kanjiDateShort } from "@/lib/kanji";
import { forgetAction, renameAction } from "@/app/actions/identity";
import { Masthead } from "@/components/masthead";
import { OpenAt } from "@/components/open-at";
import { PaperLink } from "@/components/paper-link";
import { RenameForm, Forget } from "@/components/identity-forms";
import { SoundSetting } from "@/components/sound-setting";

export const metadata = { title: "あなたのページ" };

export default async function MePage() {
  const user = await requireUser();
  const notebook = await myNotebook(user.id);

  return (
    <div className="app">
      <Masthead sub={`${user.name} さん`}>
        <PaperLink href="/write" className="masthead-link" voice="rustle">
          書く
        </PaperLink>
      </Masthead>

      <OpenAt edge="right" />
      <div className="stage">
        <div className="scroll-tate">
          <div className="roster tate fade-in" data-stream>
            {/* 帳面。自分の書いたものが、置いた部屋と一緒に並ぶ。目次と同じ一行一篇。 */}
            <section className="panel">
              <h1 className="panel-title">帳面</h1>
              {notebook.length === 0 ? (
                <p className="caption">まだ何も書いていません。</p>
              ) : (
                <div className="notebook">
                  {notebook.map((slip) => (
                    <PaperLink key={slip.id} href={`/post/${slip.id}`} className="entry">
                      <span className="entry-title">{headingOf(slip)}</span>
                      <span className="entry-meta">
                        {slip.place && slip.published ? (
                          <span className="entry-place">{slip.place.name}</span>
                        ) : (
                          <span className="seal">帳面</span>
                        )}
                        {slip.photo ? <span className="entry-mark">写</span> : null}
                        <span className="slip-when">{kanjiDateShort(slip.createdAt)}</span>
                      </span>
                    </PaperLink>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <h1 className="panel-title">名前</h1>
              <p className="caption">
                グループの中で、こう呼ばれます。いつでも変えられます。
              </p>
              <RenameForm action={renameAction} current={user.name} />
            </section>

            <section className="panel">
              <h1 className="panel-title">紙の音</h1>
              <p className="caption">
                書くときと、頁を繰るときに鳴ります。ここで止められます。
              </p>
              <SoundSetting />
            </section>

            <section className="panel">
              <h1 className="panel-title">入っているグループ</h1>
              <div className="row">
                <PaperLink href="/" className="btn" voice="rustle">
                  一覧を見る
                </PaperLink>
              </div>
            </section>

            <section className="panel">
              <h1 className="panel-title">このブラウザから消す</h1>
              <p className="caption">
                この名前は、このブラウザにだけ残っています。消すと、グループの URL をひらいて
                名前を選び直すまで戻れません。書いたものはそのまま残ります。
              </p>
              <Forget action={forgetAction} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
