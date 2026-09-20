import type { MetadataRoute } from "next";

/*
 * 目録に載せるのは戸口だけ。
 * スペースも一篇も、URL を知っている人のものなので、ここには出さない。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://tsurezure.site/", changeFrequency: "monthly", priority: 1 }];
}
