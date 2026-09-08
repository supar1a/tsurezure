"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

import { shortId } from "@/lib/ids";
import { PLACE_NAME_MAX } from "@/lib/text";

export type FormState = { error?: string } | null;

export async function createPlaceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > PLACE_NAME_MAX) {
    return { error: `グループ名は1〜${PLACE_NAME_MAX}字で入れてください。` };
  }

  const place = await prisma.place.create({
    data: {
      name,
      slug: shortId(),
      memberships: { create: { userId: user.id, role: "owner" } },
    },
  });

  revalidatePath("/");
  redirect(`/${place.slug}`);
}

/**
 * 「ここから未読」の目印のために、見た時刻だけを控える。
 * 誰が読んだかは相手に見せないし、数えもしない。
 */
export async function markAsReadAction(placeId: string) {
  const user = await requireUser();
  await prisma.membership.updateMany({
    where: { userId: user.id, placeId },
    data: { lastReadAt: new Date() },
  });
}

async function requireOwner(placeId: string) {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { userId_placeId: { userId: user.id, placeId } },
  });
  if (!membership || membership.role !== "owner") {
    throw new Error("このグループを管理する権限がありません。");
  }
  return user;
}

/**
 * グループの名前を付けなおす。
 *
 * 名前だけを変える。URL（合鍵）はそのままなので、渡してある招待状は切れないし、
 * 中に書かれたものも動かない。
 */
export async function renamePlaceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const placeId = String(formData.get("placeId") ?? "");
  await requireOwner(placeId);

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > PLACE_NAME_MAX) {
    return { error: `グループ名は1〜${PLACE_NAME_MAX}字で入れてください。` };
  }

  const place = await prisma.place.update({ where: { id: placeId }, data: { name } });

  // 名前は品書きにも一覧にも出るので、どちらも入れ替える
  revalidatePath("/");
  revalidatePath(`/${place.slug}`);
  revalidatePath(`/${place.slug}/members`);
  return null;
}

export async function removeMemberAction(formData: FormData) {
  const placeId = String(formData.get("placeId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  await requireOwner(placeId);

  const target = await prisma.membership.findUnique({
    where: { userId_placeId: { userId, placeId } },
    include: { place: true },
  });
  if (!target || target.role === "owner") return;

  await prisma.membership.delete({ where: { id: target.id } });
  revalidatePath(`/${target.place.slug}/members`);
}

export async function leavePlaceAction(formData: FormData) {
  const user = await requireUser();
  const placeId = String(formData.get("placeId") ?? "");

  const membership = await prisma.membership.findUnique({
    where: { userId_placeId: { userId: user.id, placeId } },
  });
  if (!membership || membership.role === "owner") redirect("/");

  await prisma.membership.delete({ where: { id: membership.id } });
  revalidatePath("/");
  redirect("/");
}
