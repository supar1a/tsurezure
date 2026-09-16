import { requireUser } from "@/lib/auth";
import { forgetAction, renameAction } from "@/app/actions/identity";
import { Masthead } from "@/components/masthead";
import { PaperLink } from "@/components/paper-link";
import { OpenAt } from "@/components/open-at";
import { RenameForm, Forget } from "@/components/identity-forms";
import { SoundSetting } from "@/components/sound-setting";

export const metadata = { title: "設定" };

export default async function MePage() {
  const user = await requireUser();

  return (
    <div className="app">
      <Masthead sub="設定">
        <PaperLink href="/" className="masthead-link">
          トップへ戻る
        </PaperLink>
      </Masthead>

      <OpenAt edge="right" />
      <div className="stage">
        <div className="scroll-tate">
          <div className="roster tate fade-in" data-stream>
            <section className="panel">
              <h1 className="panel-title">名前</h1>
              <p className="caption">
                スペースの中で、こう呼ばれます。いつでも変えられます。
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
              <h1 className="panel-title">このブラウザから消す</h1>
              <p className="caption">
                この名前は、このブラウザにだけ残っています。消すと、スペースの URL をひらいて
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
