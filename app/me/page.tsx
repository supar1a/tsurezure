import { requireUser } from "@/lib/auth";
import { forgetAction, renameAction } from "@/app/actions/identity";
import { Masthead } from "@/components/masthead";
import { PaperLink } from "@/components/paper-link";
import { RenameForm, Forget } from "@/components/identity-forms";
import { SoundSetting } from "@/components/sound-setting";

export const metadata = { title: "あなたのページ — つれづれ" };

export default async function MePage() {
  const user = await requireUser();

  return (
    <div className="app">
      <Masthead />

      <div className="stage">
        <div className="scroll-tate">
          <div className="roster tate fade-in">
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
