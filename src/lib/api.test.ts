import { afterEach, describe, it, expect, vi } from 'vitest';
import { ApiError, GreenApi, normalizeApiUrl, normalizePhone } from './api';
const api = new GreenApi({
  idInstance: '3100000001',
  apiTokenInstance: 'test-token-only',
  apiUrl: 'https://3100.api.green-api.com',
});
afterEach(() => vi.unstubAllGlobals());
describe('GREEN-API', () => {
  it('нормализует номера РФ и РБ', () => {
    expect(normalizePhone('8 (999) 123-45-67')).toBe('79991234567');
    expect(normalizePhone('+375 29 123-45-67')).toBe('375291234567');
  });
  it('отклоняет мусор вместо номера', () => {
    expect(() => normalizePhone('79991234567abc')).toThrow();
    expect(() => normalizePhone('123')).toThrow();
  });
  it('не отправляет ключ на посторонний сервер', () => {
    for (const url of [
      'http://api.green-api.com',
      'https://green-api.com.evil.example',
      'https://api.green-api.com@evil.example',
      'https://api.green-api.com/path',
      'https://evil.example',
    ])
      expect(() => normalizeApiUrl(url)).toThrow();
    expect(normalizeApiUrl('https://3100.api.green-api.com/v3/')).toBe(
      'https://3100.api.green-api.com',
    );
  });
  it('получает канонический chatId по номеру', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ exist: true, chatId: '101' })));
    vi.stubGlobal('fetch', fetch);
    expect(await api.checkAccount('79991234567')).toBe('101');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ phoneNumber: 79991234567 });
  });
  it('показывает понятную ошибку отсутствующего аккаунта', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ exist: false, chatId: '' }))),
    );
    await expect(api.checkAccount('79991234567')).rejects.toThrow('не найден');
  });
  it('отправляет текст правильным методом', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ idMessage: 'sent1' })));
    vi.stubGlobal('fetch', fetch);
    expect(await api.sendMessage('101', 'Привет')).toBe('sent1');
    expect(fetch.mock.calls[0][0]).toContain('/sendMessage/');
    expect(fetch.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ chatId: '101', message: 'Привет' });
  });
  it('подтверждает только receiptId полученного уведомления', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"result":true}'));
    vi.stubGlobal('fetch', fetch);
    await api.acknowledge(123, new AbortController().signal);
    expect(fetch.mock.calls[0][0]).toMatch(/\/deleteNotification\/test-token-only\/123$/);
    expect(fetch.mock.calls[0][1].method).toBe('DELETE');
  });
  it('не раскрывает тело ошибки с токеном', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('secret-token', { status: 401 })),
    );
    await expect(api.getState()).rejects.toEqual(
      new ApiError('Неверные данные подключения. Проверьте idInstance и apiTokenInstance.', 401),
    );
  });
  it('корректно обрабатывает пустую очередь', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('null')));
    expect(await api.receive(new AbortController().signal)).toBeNull();
  });
});
