import { notFound, redirect } from "next/navigation";
import { prisma } from "./db";
import { currentUser, requireUser } from "./auth";

const AUTHOR = { select: { id: true, name: true } } as const;
// 一覧では、写真の実体は読まない。大きさだけあれば組める。
const PHOTO = { select: { id: true, width: true, height: true } } as const;

/**
 * URL を持っている人のために、スペースを開ける。
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

const SHARES = { select: { place: { select: { id: true, name: true, slug: true } } } } as const;

/**
 * スペースに投げられた一篇を、古い順に（縦組みでは右から左へ流れる向き）。
 * 一篇は複数のスペースに投げられていてよい。ここではこのスペースに投げられたものだけ。
 */
export async function readableSlips(placeId: string, _userId: string, options: { authorId?: string } = {}) {
  return prisma.slip.findMany({
    where: {
      shares: { some: { placeId } },
      ...(options.authorId ? { authorId: options.authorId } : {}),
    },
    include: { author: AUTHOR, photo: PHOTO, shares: SHARES },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * 一篇を読めるか。書いた本人はいつでも。ほかの人は、投げられたスペースのどれかに入っていれば。
 * 読めるときは、その人が入っているスペースのうち一つ（柱に出す名前）も返す。
 */
export async function requireReadableSlip(slipId: string) {
  const user = await requireUser();

  const slip = await prisma.slip.findUnique({
    where: { id: slipId },
    include: { author: AUTHOR, photo: PHOTO, shares: SHARES },
  });
  if (!slip) notFound();

  const isAuthor = slip.authorId === user.id;
  const placeIds = slip.shares.map((s) => s.place.id);
  const memberships = placeIds.length
    ? await prisma.membership.findMany({ where: { userId: user.id, placeId: { in: placeIds } }, select: { placeId: true } })
    : [];
  const mine = new Set(memberships.map((m) => m.placeId));
  const through = slip.shares.map((s) => s.place).find((p) => mine.has(p.id)) ?? null;

  if (!isAuthor && !through) notFound();

  return { user, slip, isAuthor, through, shared: slip.shares.length > 0 };
}

/** ひとりのスペース。投げたものも、自分のみのものも、書いた順に。 */
export async function myNotebook(userId: string) {
  return prisma.slip.findMany({
    where: { authorId: userId },
    include: { author: AUTHOR, photo: PHOTO, shares: SHARES },
    orderBy: { createdAt: "asc" },
  });
}

/** 自分の入っているスペース。投げる先を選ぶときに使う。 */
export async function myPlaces(userId: string) {
  return prisma.place.findMany({
    where: { memberships: { some: { userId } } },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" },
  });
}
