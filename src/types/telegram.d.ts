interface TelegramWebApp {
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  openInvoice(url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;
  initData: string;
  initDataUnsafe: unknown;
  colorScheme: 'light' | 'dark';
  version?: string;
  isVersionAtLeast?(version: string): boolean;
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
