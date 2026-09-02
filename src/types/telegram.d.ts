interface TelegramBackButton {
  isVisible: boolean;
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
}

interface TelegramHapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

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
  BackButton?: TelegramBackButton;
  HapticFeedback?: TelegramHapticFeedback;
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
