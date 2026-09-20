import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { canSeeSlip } from "@/lib/guards";

const NOT_FOUND = new Response("Not found", { status: 404 });

/**
 * 写真を出す。本文と同じだけ秘密なので、同じ条件で見せる。
 * 見せてよくない人には、あることも伏せて 404 を返す。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const photo = await prisma.photo.findUnique({
    where: { id },
    include: { slip: { select: { authorId: true, open: true, shares: { select: { placeId: true } } } } },
  });
  if (!photo) return NOT_FOUND;

  // 一篇と同じ条件：書いた本人・投げられたスペースの仲間・リンクで公開中
  const user = await currentUser();
  if (!(await canSeeSlip(photo.slip, user?.id ?? null))) return NOT_FOUND;

  return new Response(Buffer.from(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.data.length),
      // 中身は変わらないので長く持たせるが、共用の置き場には残さない
      "Cache-Control": "private, max-age=31536000, immutable",
      // 誰として見ているかで結果が変わる。これが無いと、
      // 名乗りを消したあともブラウザの控えから画像が返ってしまう。
      Vary: "Cookie",
    },
  });
}
