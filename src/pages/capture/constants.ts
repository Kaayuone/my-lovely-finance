import type { ListenerEventKind } from '@/services/capture';

export const CAPTURE_TIME_FORMAT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export const LISTENER_EVENT_LABELS: Record<ListenerEventKind, string> = {
  connected: 'Служба подключилась',
  disconnected: 'Служба отключилась',
  rebind_requested: 'Запрошен перезапуск службы',
};

// A connect this soon after the phone booted is the listener coming back after a restart
export const RECENT_BOOT_MS = 10 * 60 * 1000;
