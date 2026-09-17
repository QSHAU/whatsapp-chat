import { describe, it, expect, vi, afterEach } from 'vitest';
import { pollNotifications } from './polling';
import { ApiError } from './api';
afterEach(() => vi.useRealTimers());
describe('Получение уведомлений', () => {
  it('обрабатывает уведомление до подтверждения, без параллельного опроса', async () => {
    const controller = new AbortController();
    const calls: string[] = [];
    await pollNotifications({
      signal: controller.signal,
      api: {
        receive: async () => {
          calls.push('receive');
          return { receiptId: 123, body: { typeWebhook: 'ignored' } };
        },
        acknowledge: async (id) => {
          calls.push(`ack:${id}`);
          controller.abort();
        },
      },
      onNotification: () => calls.push('apply'),
      onStatus: () => {},
    });
    expect(calls).toEqual(['receive', 'apply', 'ack:123']);
  });
  it('останавливается на недействительном ключе', async () => {
    const receive = vi.fn().mockRejectedValue(new ApiError('Неверный ключ', 401));
    const onStatus = vi.fn();
    await pollNotifications({
      signal: new AbortController().signal,
      api: { receive, acknowledge: vi.fn() },
      onNotification: vi.fn(),
      onStatus,
    });
    expect(receive).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenCalledWith(expect.any(ApiError), true);
  });
  it('повторяет запрос после сетевого сбоя с задержкой и прекращает при выходе', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const receive = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('Нет сети'))
      .mockImplementationOnce(async () => {
        controller.abort();
        return null;
      });
    const run = pollNotifications({
      signal: controller.signal,
      api: { receive, acknowledge: vi.fn() },
      onNotification: vi.fn(),
      onStatus: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(receive).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await run;
    expect(receive).toHaveBeenCalledTimes(2);
  });
});
