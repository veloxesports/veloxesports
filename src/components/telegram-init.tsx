"use client";

import { useEffect } from "react";

export function TelegramInit() {
  useEffect(() => {
    // Check if we are running inside Telegram
    if (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp) {
      const webApp = window.Telegram.WebApp;
      
      // Notify Telegram that the Mini App is ready to be displayed
      webApp.ready();
      
      // Expand the Mini App to full height
      webApp.expand();
      
      // Set the header and background colors to match our dark theme
      webApp.setHeaderColor("#000000");
      webApp.setBackgroundColor("#000000");
    }
  }, []);

  return null;
}
