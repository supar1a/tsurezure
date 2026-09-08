"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { becomeUser, createAndBecome, currentUser, forget } from "@/lib/auth";
import { shortId } from "@/lib/ids";

export type FormState = { error?: string } | null;

function readName(formData: FormData) {
  return String(formData.get("name") ?? "").trim();
}

/**
 * はじめまして。
 *
 * 名前だけ決めても、まだ何も無い画面に出るだけなので、
 * グループごと作ってもらう。名前は、その中のひとつとして聞く。
 */
export async function startAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = readName(formData);
  const placeName = String(formData.get("placeName") ?? "").trim();

  if (placeName.length < 1 || placeName.length > 32) {
    return { error: "グループ名は1〜32字で入れてください。" };
  }
  if (name.length < 1 || name.length > 24) {
    return { error: "名前は1〜24字で入れてください。" };
  }

  const user = await createAndBecome(name);
  const place = await prisma.place.create({
    data: {
      name: placeName,
      slug: shortId(),
      memberships: { create: { userId: user.id, role: "owner" } },
    },
  });

  redirect(`/${place.slug}`);
}

/**
 * 招待された URL から、そのグループに入る。
 * すでに名乗っていればその名前のまま、まだなら名前をきいてから。
 */
export async function joinAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const place = await prisma.place.findUnique({ where: { slug } });
  if (!place) return { error: "そのグループは見つかりませんでした。" };

  let user = await currentUser();
  if (!user) {
    const name = readName(formData);
    if (name.length < 1 || name.length > 24) {
      return { error: "名前は1〜24字で入れてください。" };
    }
    user = await createAndBecome(name);
  }

  await prisma.membership.upsert({
    where: { userId_placeId: { userId: user.id, placeId: place.id } },
    update: {},
    create: { userId: user.id, placeId: place.id },
  });

  revalidatePath("/");
  redirect(`/${place.slug}`);
}

/**
 * クッキーを失った人が、メンバーの中から自分を選び直す。
 *
 * 照合するものがないので、これは「なりすましできる」ということでもある。
 * グループの URL を持っている時点で中は読めるので、そこは仲間うちに委ねる。
 * せめて、すでに名乗っている人には出さない（まだ誰でもない人の戻り道に留める）。
 */
export async function iAmAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const userId = String(formData.get("userId") ?? "");

  if (await currentUser()) redirect(`/${slug}`);

  const place = await prisma.place.findUnique({ where: { slug } });
  if (!place) redirect("/");

  const membership = await prisma.membership.findUnique({
    where: { userId_placeId: { userId, placeId: place.id } },
  });
  if (!membership) redirect(`/${slug}`);

  await becomeUser(userId);
  redirect(`/${slug}`);
}

export async function forgetAction() {
  await forget();
  redirect("/");
}

/** 開発用の抜け道。本番では画面にも出さないし、呼ばれても弾く。 */
export async function becomeSomeoneAction(formData: FormData) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("この抜け道は開発中しか使えません。");
  }
  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("その人はいません。");

  await becomeUser(user.id);
  redirect("/");
}

/** 名前を変える。照合するものがないので、いつでも変えられる。 */
export async function renameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/");

  const name = readName(formData);
  if (name.length < 1 || name.length > 24) {
    return { error: "名前は1〜24字で入れてください。" };
  }

  await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/", "layout");
  redirect("/");
}
