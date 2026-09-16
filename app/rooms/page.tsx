import { redirect } from "next/navigation";

/** 昔の「スペース一覧」。いまはトップがその役目。古い URL を踏んでも迷わないように送る。 */
export default function RoomsPage() {
  redirect("/");
}
