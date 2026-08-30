interface TelegramWebApp {
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  openInvoice(url: string, callback?: (status: string) => void): void;
  initData: string;
  initDataUnsafe: any;
  colorScheme: 'light' | 'dark';
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
