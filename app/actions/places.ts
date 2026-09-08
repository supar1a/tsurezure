"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

import { shortId } from "@/lib/ids";

export type FormState = { error?: string } | null;

export async function createPlaceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 32) {
    return { error: "グループ名は1〜32字で入れてください。" };
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
