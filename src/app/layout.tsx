import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";
import { VeloxGuide } from "@/components/assistant/VeloxGuide";
import { Providers } from "@/components/providers";
import { TelegramInit } from "@/components/telegram-init";
import Script from "next/script";

export const metadata: Metadata = {
  title: "VELOX | Esports Tournaments",
  description: "A premium esports tournament platform on Telegram.",
};

export const viewport: Viewport = {
  themeColor: "#080d09",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="min-h-full flex flex-col bg-[#080d09] text-gray-100 antialiased">
        <TelegramInit />
        <Providers>
          <main className="flex-1 pb-20">
            {children}
          </main>
          <BottomNav />
          <VeloxGuide />
        </Providers>
      </body>
    </html>
  );
}
