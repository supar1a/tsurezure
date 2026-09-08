import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

const NOT_FOUND = new Response("Not found", { status: 404 });

/**
 * 写真を出す。本文と同じだけ秘密なので、同じ条件で見せる。
 * 見せてよくない人には、あることも伏せて 404 を返す。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const photo = await prisma.photo.findUnique({
    where: { id },
    include: { slip: { select: { placeId: true, authorId: true, published: true } } },
  });
  if (!photo) return NOT_FOUND;

  const user = await currentUser();
  if (!user) return NOT_FOUND;

  const membership = await prisma.membership.findUnique({
    where: { userId_placeId: { userId: user.id, placeId: photo.slip.placeId } },
  });
  if (!membership) return NOT_FOUND;
  if (!photo.slip.published && photo.slip.authorId !== user.id) return NOT_FOUND;

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
