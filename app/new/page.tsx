import { requireUser } from "@/lib/auth";
import { createPlaceAction } from "@/app/actions/places";
import { Masthead } from "@/components/masthead";
import { OpenAt } from "@/components/open-at";
import { CreatePlaceForm } from "@/components/place-forms";

export const metadata = { title: "グループを作る" };

export default async function NewPlacePage() {
  await requireUser();

  return (
    <div className="app">
      <Masthead />

      <OpenAt edge="right" />
      <div className="stage">
        <div className="scroll-tate">
          <div className="roster tate fade-in" data-stream>
            <section className="panel">
              <h1 className="panel-title">グループを作る</h1>
              <p className="caption">
                作ると招待用の URL ができます。
                <br />
                それを渡した人だけが入れます。
                <br />
                中に書いたものは、そのメンバーだけが読みます。
              </p>
              <CreatePlaceForm action={createPlaceAction} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
