import type { Metadata } from "next";
import "./globals.css";
import { SoundProvider } from "@/components/sound-provider";
import { KeyboardInset } from "@/components/keyboard-inset";

export const metadata: Metadata = {
  title: "つれづれ",
  description: "仲間うちだけの、縦書きの書き散らし。",
};

export const viewport = {
  themeColor: "#f2eee4",
  width: "device-width",
  initialScale: 1,
  // 鍵盤が出たら版面のほうを縮める。縦組みでは、覆われた先に字が流れてしまうので。
  interactiveWidget: "resizes-content" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* App Router には当たらない規則（pages/_document 向け）なので外す */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <KeyboardInset />
        <SoundProvider>{children}</SoundProvider>
      </body>
    </html>
  );
}
