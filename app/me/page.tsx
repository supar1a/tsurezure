import { requireUser } from "@/lib/auth";
import { forgetAction, renameAction } from "@/app/actions/identity";
import { Masthead } from "@/components/masthead";
import { OpenAt } from "@/components/open-at";
import { RenameForm, Forget } from "@/components/identity-forms";
import { SoundSetting } from "@/components/sound-setting";

export const metadata = { title: "設定" };

export default async function MePage() {
  const user = await requireUser();

  return (
    <div className="app">
      <Masthead />

      <OpenAt edge="right" />
      <div className="stage">
        <div className="scroll-tate">
          <div className="roster tate fade-in" data-stream>
            <h1 className="contents-title">設定</h1>

            <section className="panel">
              <h2 className="panel-title">名前</h2>
              <p className="caption">あなたの名前です。</p>
              <p className="caption">スペースごとの表示名は、別に設定できます。</p>
              <RenameForm action={renameAction} current={user.name} />
            </section>

            <section className="panel">
              <h2 className="panel-title">紙の音</h2>
              <p className="caption">
                書くときと、頁を繰るときに鳴ります。ここで止められます。
              </p>
              <SoundSetting />
            </section>

            <section className="panel">
              <h2 className="panel-title">ログアウト</h2>
              <p className="caption">この端末に保存されている名前を消します。</p>
              <p className="caption">
                これまでに書いたものは、そのまま残ります。
                <br />
                また参加するときは、スペースの URL を開いて名前を選び直してください。
              </p>
              <Forget action={forgetAction} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
