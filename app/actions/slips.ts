"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readPhoto } from "@/lib/photo";
import { TITLE_MAX, composeBody } from "@/lib/text";

export type FormState = { error?: string } | null;

async function requireMember(placeId: string) {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { userId_placeId: { userId: user.id, placeId } },
  });
  if (!membership) throw new Error("このグループのメンバーではありません。");
  return user;
}

/** 「いつもここに置く」を控える／外す。 */
async function rememberPlace(userId: string, placeId: string | null, remember: boolean) {
  if (!remember) return;
  await prisma.user.update({ where: { id: userId }, data: { defaultPlaceId: placeId } });
}

/** 自分の投稿は、いつでも編集・削除できる。 */
async function requireOwnSlip(slipId: string) {
  const user = await requireUser();
  const slip = await prisma.slip.findUnique({
    where: { id: slipId },
    include: { place: true },
  });
  if (!slip) throw new Error("その投稿はありません。");
  if (slip.authorId !== user.id) throw new Error("その投稿はあなたのものではありません。");
  return { user, slip };
}

/**
 * 書く。まず日記（自分だけ）に入り、「置く」で部屋に出る。
 * 部屋の中から書けば、置く先はその部屋。部屋の外から書けば、置く先を選ぶ。
 */
export async function writeSlipAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const published = formData.get("intent") !== "draft";
  const wanted = String(formData.get("placeId") ?? "");
  // 日記に残すだけなら、部屋は要らない
  const placeId = published ? wanted : "";
  const user = placeId ? await requireMember(placeId) : await requireUser();

  const place = placeId ? await prisma.place.findUnique({ where: { id: placeId } }) : null;
  if (published && !place) return { error: "置く先のグループを選んでください。" };

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
    data: { placeId: place?.id ?? null, authorId: user.id, title: title || null, body, published },
  });
  if (photo) {
    await prisma.photo.create({ data: { slipId: slip.id, ...photo } });
  }
  if (place) await rememberPlace(user.id, place.id, formData.get("remember") === "1");

  if (place) revalidatePath(`/${place.slug}`);
  revalidatePath("/");
  // 部屋の中から書いたなら部屋へ、日記から書いたなら日記へ
  const back = String(formData.get("back") ?? "");
  redirect(back.startsWith("/") ? back : place ? `/${place.slug}` : "/");
}

export async function saveSlipAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const slipId = String(formData.get("slipId") ?? "");
  const { slip } = await requireOwnSlip(slipId);

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

  // 「下書きに保存」なら日記へ戻す（部屋からも外す）
  const toNotebook = formData.get("intent") === "draft";
  const published = toNotebook ? false : slip.published;

  const title = String(formData.get("title") ?? "").trim();
  if (title.length > TITLE_MAX) return { error: `題は${TITLE_MAX}字までです。` };
  await prisma.slip.update({
    where: { id: slipId },
    data: { title: title || null, body, published, ...(toNotebook ? { placeId: null } : {}) },
  });

  // 貼り直したときは、古いほうを消してから入れ替える
  if (photo || removed) {
    await prisma.photo.deleteMany({ where: { slipId } });
  }
  if (photo) {
    await prisma.photo.create({ data: { slipId, ...photo } });
  }

  if (slip.place) revalidatePath(`/${slip.place.slug}`);
  revalidatePath(`/post/${slipId}`);
  revalidatePath("/");
  redirect(`/post/${slipId}`);
}

/** 日記の一篇を、部屋に置く。 */
export async function placeSlipAction(formData: FormData) {
  const slipId = String(formData.get("slipId") ?? "");
  const placeId = String(formData.get("placeId") ?? "");
  const { user, slip } = await requireOwnSlip(slipId);
  await requireMember(placeId);
  const place = await prisma.place.findUnique({ where: { id: placeId } });
  if (!place) throw new Error("そのグループはありません。");

  await prisma.slip.update({ where: { id: slipId }, data: { placeId, published: true } });
  await rememberPlace(user.id, placeId, formData.get("remember") === "1");

  if (slip.place) revalidatePath(`/${slip.place.slug}`);
  revalidatePath(`/${place.slug}`);
  revalidatePath(`/post/${slipId}`);
  revalidatePath("/");
}

/** 部屋から下げて、日記へ戻す。 */
export async function withdrawSlipAction(formData: FormData) {
  const slipId = String(formData.get("slipId") ?? "");
  const { slip } = await requireOwnSlip(slipId);

  await prisma.slip.update({ where: { id: slipId }, data: { placeId: null, published: false } });

  if (slip.place) revalidatePath(`/${slip.place.slug}`);
  revalidatePath(`/post/${slipId}`);
  revalidatePath("/");
}

export async function deleteSlipAction(formData: FormData) {
  const slipId = String(formData.get("slipId") ?? "");
  const { slip } = await requireOwnSlip(slipId);

  await prisma.slip.delete({ where: { id: slipId } });

  if (slip.place) revalidatePath(`/${slip.place.slug}`);
  revalidatePath("/");
  redirect("/");
}
