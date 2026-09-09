import { requireUser } from "@/lib/auth";
import { forgetAction, renameAction } from "@/app/actions/identity";
import { Masthead } from "@/components/masthead";
import { PaperLink } from "@/components/paper-link";
import { RenameForm, Forget } from "@/components/identity-forms";

export const metadata = { title: "あなたのページ — つれづれ" };

export default async function MePage() {
  const user = await requireUser();

  return (
    <div className="app">
      <Masthead>
        <PaperLink href="/" className="masthead-link">
          入っているグループ
        </PaperLink>
      </Masthead>

      <div className="stage">
        <div className="scroll-tate">
          <div className="roster tate fade-in">
            <section className="panel">
              <h1 className="panel-title">名前</h1>
              <p className="caption">
                グループの中で、こう呼ばれます。
                <br />
                いつでも変えられます。
              </p>
              <RenameForm action={renameAction} current={user.name} />
            </section>

            <section className="panel">
              <h1 className="panel-title">このブラウザから消す</h1>
              <p className="caption">
                この名前は、このブラウザにだけ残っています。
                <br />
                消すと、グループの URL をひらいて
                <br />
                名前を選び直すまで戻れません。
                <br />
                書いたものはそのまま残ります。
              </p>
              <Forget action={forgetAction} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
