import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "阿寶 Abao",
  description: "A personal AI agent for your parents. It checks with family before money moves.",
  appleWebApp: { capable: true, title: "阿寶", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#f97316", width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW" className="h-full">
      <body className="h-full">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
