import type { Notification } from '../types';
import { ApiError } from './api';

export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function pollNotifications(options: {
  api: {
    receive: (signal: AbortSignal) => Promise<Notification | null>;
    acknowledge: (receiptId: number, signal: AbortSignal) => Promise<void>;
  };
  signal: AbortSignal;
  onNotification: (notification: Notification) => void;
  onStatus: (error: Error | null, stopped: boolean) => void;
}) {
  const { api, signal, onNotification, onStatus } = options;
  let failures = 0;
  while (!signal.aborted) {
    try {
      const notification = await api.receive(signal);
      if (signal.aborted) break;
      if (notification) {
        // Сначала применяем событие, затем подтверждаем. Повторную доставку отсекает reducer.
        onNotification(notification);
        await api.acknowledge(notification.receiptId, signal);
      }
      if (signal.aborted) break;
      failures = 0;
      onStatus(null, false);
      await delay(notification ? 120 : 300, signal);
    } catch (error) {
      if (signal.aborted) break;
      const stopped = error instanceof ApiError && [400, 401, 403, 404, 466].includes(error.status);
      onStatus(error instanceof Error ? error : new Error('Ошибка соединения.'), stopped);
      if (stopped) break;
      failures++;
      try {
        await delay(Math.min(1000 * 2 ** Math.min(failures - 1, 5), 30000), signal);
      } catch {
        break;
      }
    }
  }
}
