import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 紙の上に開発用の印を出さない
  devIndicators: false,
  experimental: {
    // 写真はブラウザ側で縮めてから送るが、その余裕を見ておく
    serverActions: { bodySizeLimit: "4mb" },
  },

  /*
   * グループの URL から `/b/` を外した。
   * 招待状は人に渡してあるもので、こちらの都合で切ってよいものではないので、
   * 前の形は新しい形へ送りつづける。
   */
  async redirects() {
    return [
      { source: "/b/:slug", destination: "/:slug", permanent: true },
      { source: "/b/:slug/:rest*", destination: "/:slug/:rest*", permanent: true },
    ];
  },
};

export default nextConfig;
