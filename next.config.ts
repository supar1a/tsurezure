import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 紙の上に開発用の印を出さない
  devIndicators: false,
  experimental: {
    // 写真はブラウザ側で縮めてから送るが、その余裕を見ておく
    serverActions: { bodySizeLimit: "4mb" },
  },

  /*
   * 道筋から意味の分からない一文字を外した（`/b/` はグループ、`/s/` は一篇のつもりだった）。
   * どちらも人の手に渡っているかもしれないので、前の形は新しい形へ送りつづける。
   */
  async redirects() {
    return [
      { source: "/b/:slug", destination: "/:slug", permanent: true },
      { source: "/b/:slug/:rest*", destination: "/:slug/:rest*", permanent: true },
      { source: "/s/:id", destination: "/post/:id", permanent: true },
      { source: "/s/:id/:rest*", destination: "/post/:id/:rest*", permanent: true },
    ];
  },
};

export default nextConfig;
