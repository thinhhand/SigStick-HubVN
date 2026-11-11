import type { Metadata, Viewport } from "next";
import { APP_VERSION } from "@/config/version";
import "./globals.css";

export const metadata: Metadata = {
  title: "SigStick Hub VN — Kho Sticker cho Zalo, Messenger & Telegram",
  description:
    "Khám phá hàng triệu Sticker từ SigStick. Tự động chuyển đổi sang PNG & GIF động để Copy dán thẳng hoặc Chia sẻ ngay qua Zalo, Messenger, Discord.",
  manifest: "/manifest.json",
  authors: [{ name: "Đặng Ngọc Thịnh" }],
  creator: "Đặng Ngọc Thịnh",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  other: {
    "app-version": APP_VERSION,
    copyright: "© Đặng Ngọc Thịnh",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f7fb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-dvh bg-[#f4f7fb] text-slate-800 antialiased selection:bg-indigo-500/15 selection:text-indigo-700">
        {children}
      </body>
    </html>
  );
}
