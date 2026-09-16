"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readPhoto } from "@/lib/photo";
import { TITLE_MAX, composeBody } from "@/lib/text";

export type FormState = { error?: string } | null;

/** 自分の投稿は、いつでも編集・削除できる。 */
async function requireOwnSlip(slipId: string) {
  const user = await requireUser();
  const slip = await prisma.slip.findUnique({ where: { id: slipId } });
  if (!slip) throw new Error("その投稿はありません。");
  if (slip.authorId !== user.id) throw new Error("その投稿はあなたのものではありません。");
  return { user, slip };
}

/** 投げる先として選ばれたスペース。自分が入っているものだけに絞る。 */
async function chosenPlaces(userId: string, formData: FormData) {
  const wanted = formData.getAll("placeIds").map(String).filter(Boolean);
  if (wanted.length === 0) return [];
  return prisma.place.findMany({
    where: { id: { in: wanted }, memberships: { some: { userId } } },
    select: { id: true, slug: true },
  });
}

/** 最後に投げたスペースを控える。次に書くとき、先にチェックしておくため。 */
async function rememberPlaces(userId: string, placeIds: string[]) {
  if (placeIds.length === 0) return;
  await prisma.user.update({ where: { id: userId }, data: { lastPlaceIds: placeIds } });
}

/**
 * 投稿する。スペースが選ばれていればそこにも投げる（複数でよい）。選ばれていなければ自分のみ。
 * 最後に投げたスペースは控えておき、次に書くときの初期値にする。
 */
export async function writeSlipAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const places = await chosenPlaces(user.id, formData);

  // 写真は本文の途中に挟まるので、前と後ろに分かれて届く
  const photo = await readPhoto(formData);
  const body = composeBody(
    String(formData.get("bodyBefore") ?? ""),
    String(formData.get("bodyAfter") ?? ""),
    Boolean(photo),
  );
  if (!body) return { error: "まだ何も書かれていません。" };

  const title = String(formData.get("title") ?? "").trim();
  if (title.length > TITLE_MAX) return { error: `題は${TITLE_MAX}字までです。` };

  const slip = await prisma.slip.create({
    data: {
      authorId: user.id,
      title: title || null,
      body,
      shares: { create: places.map((p) => ({ placeId: p.id })) },
    },
  });
  if (photo) {
    await prisma.photo.create({ data: { slipId: slip.id, ...photo } });
  }
  await rememberPlaces(user.id, places.map((p) => p.id));

  for (const p of places) revalidatePath(`/${p.slug}`);
  revalidatePath("/");
  // スペースの中から書いたならそのスペースへ、ひとりのスペースから書いたならそこへ
  const back = String(formData.get("back") ?? "");
  redirect(back.startsWith("/") ? back : "/");
}

export async function saveSlipAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const slipId = String(formData.get("slipId") ?? "");
  const { user } = await requireOwnSlip(slipId);

  const photo = await readPhoto(formData);
  const removed = formData.get("photoRemove") === "1";
  const kept = await prisma.photo.findUnique({ where: { slipId }, select: { id: true } });

  // 印を入れてよいのは、実際に写真が残るときだけ
  const willHavePhoto = Boolean(photo) || (Boolean(kept) && !removed);
  const body = composeBody(
    String(formData.get("bodyBefore") ?? ""),
    String(formData.get("bodyAfter") ?? ""),
    willHavePhoto,
  );
  if (!body) return { error: "まだ何も書かれていません。" };

  // 投げる先。選び直せる（外せば自分のみに戻る）。
  const places = await chosenPlaces(user.id, formData);
  const before = await prisma.share.findMany({ where: { slipId }, select: { place: { select: { slug: true } } } });

  const title = String(formData.get("title") ?? "").trim();
  if (title.length > TITLE_MAX) return { error: `題は${TITLE_MAX}字までです。` };
  await prisma.slip.update({
    where: { id: slipId },
    data: {
      title: title || null,
      body,
      shares: { deleteMany: {}, create: places.map((p) => ({ placeId: p.id })) },
    },
  });
  await rememberPlaces(user.id, places.map((p) => p.id));
  for (const p of places) revalidatePath(`/${p.slug}`);
  for (const b of before) revalidatePath(`/${b.place.slug}`);

  // 貼り直したときは、古いほうを消してから入れ替える
  if (photo || removed) {
    await prisma.photo.deleteMany({ where: { slipId } });
  }
  if (photo) {
    await prisma.photo.create({ data: { slipId, ...photo } });
  }

  revalidatePath(`/post/${slipId}`);
  revalidatePath("/");
  redirect(`/post/${slipId}`);
}

/** 一篇の投げる先を決め直す。チェックしたスペースに投げ、外したものからは引く。 */
export async function shareSlipAction(formData: FormData) {
  const slipId = String(formData.get("slipId") ?? "");
  const { user } = await requireOwnSlip(slipId);
  const places = await chosenPlaces(user.id, formData);
  const before = await prisma.share.findMany({ where: { slipId }, select: { place: { select: { slug: true } } } });

  await prisma.slip.update({
    where: { id: slipId },
    data: { shares: { deleteMany: {}, create: places.map((p) => ({ placeId: p.id })) } },
  });
  await rememberPlaces(user.id, places.map((p) => p.id));

  for (const p of places) revalidatePath(`/${p.slug}`);
  for (const b of before) revalidatePath(`/${b.place.slug}`);
  revalidatePath(`/post/${slipId}`);
  revalidatePath("/");
}

export async function deleteSlipAction(formData: FormData) {
  const slipId = String(formData.get("slipId") ?? "");
  const { slip } = await requireOwnSlip(slipId);
  const shares = await prisma.share.findMany({ where: { slipId }, select: { place: { select: { slug: true } } } });

  await prisma.slip.delete({ where: { id: slip.id } });

  for (const s of shares) revalidatePath(`/${s.place.slug}`);
  revalidatePath("/");
  redirect("/private");
}
