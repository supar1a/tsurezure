import { kanjiDateShort } from "@/lib/kanji";
import { linkify, paragraphs, splitAroundPhoto } from "@/lib/text";
import { PaperLink } from "./paper-link";

export type SlipRow = {
  id: string;
  title: string | null;
  body: string;
  published: boolean;
  createdAt: Date;
  author: { id: string; name: string };
  photo: { id: string; width: number; height: number } | null;
};

/**
 * 巻物のなかの一枚。全文を出す。
 * 名前と日付だけがリンクで、本文はただの文字。走り読みさせず、読ませるため。
 */
export function SlipColumn({
  slip,
  slug,
  mine = false,
}: {
  slip: SlipRow;
  slug: string;
  /** 自分の書いたものか。だとすれば、開けば直せるし消せる。 */
  mine?: boolean;
}) {
  return (
    <article className="slip">
      <header className="slip-head">
        <PaperLink
          href={`/${slug}/by/${slip.author.id}`}
          className="slip-who"
          voice="rustle"
        >
          {slip.author.name}
        </PaperLink>

        <div className="slip-meta">
          {!slip.published ? <span className="seal">下書き</span> : null}
          {mine ? <span className="slip-mine">じぶん</span> : null}
          <PaperLink href={`/post/${slip.id}`} className="slip-when">
            {kanjiDateShort(slip.createdAt)}
          </PaperLink>
        </div>
      </header>

      <SlipText body={slip.body} photo={slip.photo} />
    </article>
  );
}

/** 貼られた一枚。行の高さに収まるところまで縮めて、紙に置いたように見せる。 */
export function SlipPhoto({
  photo,
  className = "slip-photo",
}: {
  photo: { id: string; width: number; height: number };
  className?: string;
}) {
  return (
    <div className={className}>
      {/* next/image は縦組みの中で扱いにくいので、素の img で置く */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/photo/${photo.id}`}
        alt=""
        width={photo.width}
        height={photo.height}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

/**
 * 本文と、その途中に置かれた写真。
 * 印のところで割って、前・写真・後ろ の順に並べる。
 */
export function SlipText({
  body,
  photo,
  bodyClassName = "slip-body",
  photoClassName = "slip-photo",
}: {
  body: string;
  photo: { id: string; width: number; height: number } | null;
  bodyClassName?: string;
  photoClassName?: string;
}) {
  if (!photo) {
    return <Prose body={body} className={bodyClassName} />;
  }

  const { before, after } = splitAroundPhoto(body);

  return (
    <>
      {before ? <Prose body={before} className={bodyClassName} /> : null}
      <SlipPhoto photo={photo} className={photoClassName} />
      {after ? <Prose body={after} className={bodyClassName} /> : null}
    </>
  );
}

function Prose({ body, className }: { body: string; className: string }) {
  return (
    <div className={className}>
      {paragraphs(body).map((line, index) => (
        <p key={index} className={line.afterBlank ? "line line-apart" : "line"}>
          {linkify(line.text).map((piece, i) =>
            piece.link ? (
              <a key={i} className="link" href={piece.value} target="_blank" rel="noreferrer">
                {piece.value}
              </a>
            ) : (
              <span key={i}>{piece.value}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
