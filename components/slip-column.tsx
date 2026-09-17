import { kanjiDateShort } from "@/lib/kanji";
import { linkify, paragraphs, splitAroundPhoto } from "@/lib/text";
import { glyphOf } from "@/lib/marks";
import { PaperLink } from "./paper-link";
import { CheckMark } from "./check-mark";

export type SlipRow = {
  id: string;
  title: string | null;
  body: string;
  createdAt: Date;
  author: { id: string; name: string };
  photo: { id: string; width: number; height: number } | null;
  /** 投げたスペース。無ければ自分のみ。 */
  shares?: { place: { id: string; name: string; slug: string } }[];
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
          {mine ? <span className="slip-mine">じぶん</span> : null}
          <PaperLink href={`/post/${slip.id}`} className="slip-when">
            {kanjiDateShort(slip.createdAt)}
          </PaperLink>
        </div>
      </header>

      {/* 題名があれば、本文の前に一列だけ立てる */}
      {slip.title ? <h3 className="slip-title">{slip.title}</h3> : null}

      <SlipText body={slip.body} photo={slip.photo} />
    </article>
  );
}

/**
 * ひとりのスペースのなかの一枚。自分のものなので名前は出さず、日付と題名だけ。
 * どこに投稿したかは、ここでは出さない（一篇の頁で扱う）。日付を押せば、その一枚をひらく。
 */
export function DiaryColumn({ slip }: { slip: SlipRow }) {
  return (
    <article className="slip">
      <header className="slip-head">
        <div className="slip-meta">
          <PaperLink href={`/post/${slip.id}`} className="slip-when">
            {kanjiDateShort(slip.createdAt)}
          </PaperLink>
        </div>
      </header>

      {slip.title ? <h3 className="slip-title">{slip.title}</h3> : null}

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
  toggleId,
}: {
  body: string;
  photo: { id: string; width: number; height: number } | null;
  bodyClassName?: string;
  photoClassName?: string;
  /** 書いた本人が読んでいるとき、チェックを押して反転できる。その一篇の id。 */
  toggleId?: string;
}) {
  if (!photo) {
    return <Prose body={body} className={bodyClassName} toggleId={toggleId} />;
  }

  const { before, after } = splitAroundPhoto(body);
  // 写真のあとの本文は、生の行番号が写真の前のぶんだけずれる
  const offset = before ? before.split("\n").length + 1 : 0;

  return (
    <>
      {before ? <Prose body={before} className={bodyClassName} toggleId={toggleId} /> : null}
      <SlipPhoto photo={photo} className={photoClassName} />
      {after ? <Prose body={after} className={bodyClassName} toggleId={toggleId} offset={offset} /> : null}
    </>
  );
}

function Prose({
  body,
  className,
  toggleId,
  offset = 0,
}: {
  body: string;
  className: string;
  toggleId?: string;
  offset?: number;
}) {
  return (
    <div className={className}>
      {paragraphs(body).map((line, index) =>
        line.rule ? (
          <hr key={index} className="line-rule" />
        ) : (
        <p key={index} className={[line.afterBlank ? "line line-apart" : "line", line.mark ? "line-marked" : ""].join(" ").trim()}>
          {line.mark?.kind === "check" ? (
            <CheckMark done={line.mark.done} slipId={toggleId} lineIndex={offset + line.index} />
          ) : line.mark ? (
            <span className="line-mark">{glyphOf(line.mark)}</span>
          ) : null}
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
        ),
      )}
    </div>
  );
}
