import { requireUser } from "@/lib/auth";
import { createPlaceAction } from "@/app/actions/places";
import { Masthead } from "@/components/masthead";
import { OpenAt } from "@/components/open-at";
import { CreatePlaceForm } from "@/components/place-forms";

export const metadata = { title: "スペースを作る" };

export default async function NewPlacePage() {
  await requireUser();

  return (
    <div className="app">
      <Masthead sub="スペースを作る" />

      <OpenAt edge="right" />
      <div className="stage">
        <div className="scroll-tate">
          <div className="roster tate fade-in" data-stream>
            <section className="panel">
              <h1 className="panel-title">スペースを作る</h1>
              <p className="caption">
                スペースの URL を、LINE などでメンバーにシェアしましょう。
                <br />
                スペースには、URL を知っている人だけがアクセスできます。
              </p>
              <CreatePlaceForm action={createPlaceAction} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
