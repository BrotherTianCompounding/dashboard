import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "天哥投资仪表盘 | Portfolio Dashboard",
  description: "百万之路 — 投资组合追踪仪表盘",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-gray-200 antialiased">
        {children}
      </body>
    </html>
  );
}
