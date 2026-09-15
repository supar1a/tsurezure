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
 * 投稿する。共有先（placeId）が選ばれていればそのグループに出る。選ばれていなければ自分のみ。
 * 最後に共有したグループは控えておき、次に書くときの初期値にする。
 */
export async function writeSlipAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const placeId = String(formData.get("placeId") ?? "");
  const user = placeId ? await requireMember(placeId) : await requireUser();
  const place = placeId ? await prisma.place.findUnique({ where: { id: placeId } }) : null;
  if (placeId && !place) return { error: "そのグループはありません。" };

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
    data: { placeId: place?.id ?? null, authorId: user.id, title: title || null, body, published: Boolean(place) },
  });
  if (photo) {
    await prisma.photo.create({ data: { slipId: slip.id, ...photo } });
  }
  if (place) await rememberPlace(user.id, place.id, true);

  if (place) revalidatePath(`/${place.slug}`);
  revalidatePath("/");
  // グループの中から書いたならそのグループへ、日記から書いたなら日記へ
  const back = String(formData.get("back") ?? "");
  redirect(back.startsWith("/") ? back : place ? `/${place.slug}` : "/");
}

export async function saveSlipAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const slipId = String(formData.get("slipId") ?? "");
  const { user, slip } = await requireOwnSlip(slipId);

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

  // 共有先。選び直せる（共有しない ⇔ どれかのグループ）。
  const placeId = String(formData.get("placeId") ?? "");
  if (placeId) await requireMember(placeId);
  const nextPlace = placeId ? await prisma.place.findUnique({ where: { id: placeId } }) : null;
  if (placeId && !nextPlace) return { error: "そのグループはありません。" };

  const title = String(formData.get("title") ?? "").trim();
  if (title.length > TITLE_MAX) return { error: `題は${TITLE_MAX}字までです。` };
  await prisma.slip.update({
    where: { id: slipId },
    data: { title: title || null, body, placeId: nextPlace?.id ?? null, published: Boolean(nextPlace) },
  });
  if (nextPlace) await rememberPlace(user.id, nextPlace.id, true);
  if (nextPlace) revalidatePath(`/${nextPlace.slug}`);

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

/** 一篇をグループに共有する。 */
export async function placeSlipAction(formData: FormData) {
  const slipId = String(formData.get("slipId") ?? "");
  const placeId = String(formData.get("placeId") ?? "");
  const { user, slip } = await requireOwnSlip(slipId);
  await requireMember(placeId);
  const place = await prisma.place.findUnique({ where: { id: placeId } });
  if (!place) throw new Error("そのグループはありません。");

  await prisma.slip.update({ where: { id: slipId }, data: { placeId, published: true } });
  await rememberPlace(user.id, placeId, true);

  if (slip.place) revalidatePath(`/${slip.place.slug}`);
  revalidatePath(`/${place.slug}`);
  revalidatePath(`/post/${slipId}`);
  revalidatePath("/");
}

/** 共有をやめる。自分のみに戻る。 */
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
