import type { MetadataRoute } from "next";

/*
 * 探しものからは、まるごと外す。
 *
 * グループに入れるかどうかは URL を知っているかだけで決まる。
 * 目録に載れば、知らない人がそこへ行き着けてしまう。
 * 貼ったときの名札（OGP）は別の仕組みなので、これで消えることはない。
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
