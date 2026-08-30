import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";
import { Providers } from "@/components/providers";
import { TelegramInit } from "@/components/telegram-init";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VELOX | Esports Tournaments",
  description: "A premium esports tournament platform on Telegram.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
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
    <html lang="en" className="dark h-full">
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className={`${inter.className} min-h-full flex flex-col bg-black text-gray-100 antialiased`}>
        <TelegramInit />
        <Providers>
          <main className="flex-1 pb-16">
            {children}
          </main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
