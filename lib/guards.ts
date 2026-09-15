import { notFound, redirect } from "next/navigation";
import { prisma } from "./db";
import { currentUser, requireUser } from "./auth";

const AUTHOR = { select: { id: true, name: true } } as const;
// 一覧では、写真の実体は読まない。大きさだけあれば組める。
const PHOTO = { select: { id: true, width: true, height: true } } as const;

/**
 * URL を持っている人のために、グループを開ける。
 * この URL 自体が招待状なので、まだメンバーでない人にも「あること」は見せる
 * （名前と、ひとことと、誰がいるかまで。中身は見せない）。
 */
export async function openPlace(slug: string) {
  const place = await prisma.place.findUnique({ where: { slug } });
  if (!place) notFound();

  const user = await currentUser();
  const membership = user
    ? await prisma.membership.findUnique({
        where: { userId_placeId: { userId: user.id, placeId: place.id } },
      })
    : null;

  return { user, place, membership };
}

/** 中身を読む画面で使う。メンバーでなければ、入口へ戻す。 */
export async function requirePlace(slug: string) {
  const { user, place, membership } = await openPlace(slug);
  if (!user || !membership) redirect(`/${slug}`);
  return { user, place, membership };
}

/**
 * 読める投稿を、古い順に（縦組みでは右から左へ流れる向き）。
 * 下書きは、書いた本人にだけ見える。
 */
export async function readableSlips(
  placeId: string,
  userId: string,
  options: { authorId?: string } = {},
) {
  return prisma.slip.findMany({
    where: {
      placeId,
      ...(options.authorId ? { authorId: options.authorId } : {}),
      OR: [{ published: true }, { authorId: userId }],
    },
    include: { author: AUTHOR, photo: PHOTO },
    orderBy: { createdAt: "asc" },
  });
}

export async function requireReadableSlip(slipId: string) {
  const user = await requireUser();

  const slip = await prisma.slip.findUnique({
    where: { id: slipId },
    include: { author: AUTHOR, place: true, photo: PHOTO },
  });
  if (!slip) notFound();

  const isAuthor = slip.authorId === user.id;

  // 日記の中（部屋に置いていない）は、書いた本人だけ
  if (!slip.placeId) {
    if (!isAuthor) notFound();
    return { user, slip, membership: null, isAuthor };
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_placeId: { userId: user.id, placeId: slip.placeId } },
  });
  if (!membership) notFound();
  if (!slip.published && !isAuthor) notFound();

  return { user, slip, membership, isAuthor };
}

/** 自分の日記。部屋に置いたものも、置いていないものも、書いた順に。 */
export async function myNotebook(userId: string) {
  return prisma.slip.findMany({
    where: { authorId: userId },
    include: { author: AUTHOR, photo: PHOTO, place: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/** 自分の入っている部屋。置く先を選ぶときに使う。 */
export async function myPlaces(userId: string) {
  return prisma.place.findMany({
    where: { memberships: { some: { userId } } },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" },
  });
}
