import type { Metadata, Viewport } from "next";
import { APP_VERSION } from "@/config/version";
import "./globals.css";

export const metadata: Metadata = {
  title: "SigStick Hub VN — Kho Sticker cho Zalo, Messenger & Telegram",
  description:
    "Khám phá hàng triệu Sticker từ SigStick. Tự động chuyển đổi sang PNG & GIF động để Copy dán thẳng hoặc Chia sẻ ngay qua Zalo, Messenger, Discord.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  other: {
    "app-version": APP_VERSION,
  },
};

export const viewport: Viewport = {
  themeColor: "#090d16",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
