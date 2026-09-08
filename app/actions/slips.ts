"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readPhoto } from "@/lib/photo";
import { composeBody } from "@/lib/text";

export type FormState = { error?: string } | null;

async function requireMember(placeId: string) {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { userId_placeId: { userId: user.id, placeId } },
  });
  if (!membership) throw new Error("このグループのメンバーではありません。");
  return user;
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

export async function writeSlipAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const placeId = String(formData.get("placeId") ?? "");
  const user = await requireMember(placeId);

  const place = await prisma.place.findUnique({ where: { id: placeId } });
  if (!place) throw new Error("そのグループはありません。");

  // 写真は本文の途中に挟まるので、前と後ろに分かれて届く
  const photo = await readPhoto(formData);
  const body = composeBody(
    String(formData.get("bodyBefore") ?? ""),
    String(formData.get("bodyAfter") ?? ""),
    Boolean(photo),
  );
  if (!body) return { error: "まだ何も書かれていません。" };

  const published = formData.get("intent") !== "draft";
  const title = String(formData.get("title") ?? "").trim();

  const slip = await prisma.slip.create({
    data: { placeId, authorId: user.id, title: title || null, body, published },
  });
  if (photo) {
    await prisma.photo.create({ data: { slipId: slip.id, ...photo } });
  }

  revalidatePath(`/${place.slug}`);
  redirect(published ? `/${place.slug}` : `/post/${slip.id}`);
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

  const published = formData.get("intent") === "draft" ? false : slip.published;

  const title = String(formData.get("title") ?? "").trim();
  await prisma.slip.update({
    where: { id: slipId },
    data: { title: title || null, body, published },
  });

  // 貼り直したときは、古いほうを消してから入れ替える
  if (photo || removed) {
    await prisma.photo.deleteMany({ where: { slipId } });
  }
  if (photo) {
    await prisma.photo.create({ data: { slipId, ...photo } });
  }

  revalidatePath(`/${slip.place.slug}`);
  revalidatePath(`/post/${slipId}`);
  redirect(`/post/${slipId}`);
}

/** 公開する／下書きに戻す。 */
export async function setPublishedAction(formData: FormData) {
  const slipId = String(formData.get("slipId") ?? "");
  const published = formData.get("published") === "true";
  const { slip } = await requireOwnSlip(slipId);

  await prisma.slip.update({ where: { id: slipId }, data: { published } });

  revalidatePath(`/${slip.place.slug}`);
  revalidatePath(`/post/${slipId}`);
}

export async function deleteSlipAction(formData: FormData) {
  const slipId = String(formData.get("slipId") ?? "");
  const { slip } = await requireOwnSlip(slipId);

  await prisma.slip.delete({ where: { id: slipId } });

  revalidatePath(`/${slip.place.slug}`);
  redirect(`/${slip.place.slug}`);
}
