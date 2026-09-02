"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authenticateTelegram } from "@/features/auth/actions";

export function TelegramInit() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if we are running inside Telegram
    if (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp) {
      const webApp = window.Telegram.WebApp;
      
      // Notify Telegram that the Mini App is ready to be displayed
      webApp.ready();
      
      // Expand the Mini App to full height
      webApp.expand();
      
      // These APIs are not available in older Telegram clients. The application
      // still renders correctly there, without triggering client-side warnings.
      if (webApp.isVersionAtLeast?.("6.1")) {
        webApp.setHeaderColor("#080d09");
        webApp.setBackgroundColor("#080d09");
      }

      // initData is the only Telegram-provided client value sent to the server.
      // The server validates its signature before creating a VELOX session.
      if (webApp.initData) {
        void authenticateTelegram(webApp.initData).then((result) => {
          if (result.success) router.refresh();
        });
      }
    }
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp?.BackButton) {
      const backButton = window.Telegram.WebApp.BackButton;
      const isTopLevel = pathname === "/" || pathname === "/tournaments" || pathname.startsWith("/admin");

      if (isTopLevel) {
        backButton.hide();
      } else {
        backButton.show();
        const handleBack = () => router.back();
        backButton.onClick(handleBack);
        return () => {
          backButton.offClick(handleBack);
        };
      }
    }
  }, [pathname, router]);

  return null;
}
