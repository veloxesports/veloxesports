import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";
import { KhemoraGuide } from "@/components/assistant/KhemoraGuide";
import { Providers } from "@/components/providers";
import { TelegramInit } from "@/components/telegram-init";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Khemora Esports | Tournaments",
  description: "A premium esports tournament platform on Telegram.",
  icons: {
    icon: "/images/khemora-logo.png",
    apple: "/images/khemora-logo.png",
  },
  openGraph: {
    title: "Khemora Esports | Tournaments",
    description: "A premium esports tournament platform on Telegram.",
    images: ["/images/khemora-logo.png"],
  },
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
          <div className="flex-1 pb-24 sm:pb-28 has-[.admin-shell]:pb-0">
            {children}
          </div>
          <BottomNav />
          <KhemoraGuide />
        </Providers>
      </body>
    </html>
  );
}
