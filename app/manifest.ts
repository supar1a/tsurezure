import type { MetadataRoute } from "next";
import { ABOUT, SITE } from "@/lib/meta";

/**
 * ホーム画面に置けるようにする、その入口だけ。
 * オフラインの仕組み（Service Worker）や通知は持たない。書いたものは DB に直接入るので、
 * 途中で切れたときの手当ては下書きの控えで足りる。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE,
    short_name: SITE,
    description: ABOUT,
    lang: "ja",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f7f5",
    theme_color: "#f7f7f5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
