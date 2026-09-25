import { afterEach, describe, it, expect, vi } from 'vitest';
import { ApiError, GreenApi, normalizeApiUrl, normalizePhone } from './api';
const api = new GreenApi({
  idInstance: '1101000001',
  apiTokenInstance: 'test-token-only',
  apiUrl: 'https://1101.api.green-api.com',
});
afterEach(() => vi.unstubAllGlobals());
describe('GREEN-API', () => {
  it('нормализует международные номера', () => {
    expect(normalizePhone('8 (999) 123-45-67')).toBe('79991234567');
    expect(normalizePhone('+44 7700 900123')).toBe('447700900123');
    expect(normalizePhone('+81 90 1234 567')).toBe('81901234567');
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
      'https://7107.api.greenapi.com.evil.example',
      'https://fakegreenapi.com',
      'https://7107.api.greenapi.com@evil.example',
    ])
      expect(() => normalizeApiUrl(url)).toThrow();
    expect(normalizeApiUrl('https://7107.api.greenapi.com/')).toBe('https://7107.api.greenapi.com');
    expect(normalizeApiUrl('https://1101.api.green-api.com/')).toBe(
      'https://1101.api.green-api.com',
    );
  });
  it('получает канонический chatId по номеру', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ existsWhatsapp: true, chatId: '123456789012345@lid' })),
      );
    vi.stubGlobal('fetch', fetch);
    expect(await api.checkWhatsapp('79991234567')).toBe('123456789012345@lid');
    expect(fetch.mock.calls[0][0]).toContain('/checkWhatsapp/');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ chatId: '79991234567@c.us' });
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ existsWhatsapp: true })));
    expect(await api.checkWhatsapp('79991234567')).toBe('79991234567@c.us');
  });
  it('показывает понятную ошибку отсутствующего аккаунта', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ existsWhatsapp: false, chatId: '' }))),
    );
    await expect(api.checkWhatsapp('79991234567')).rejects.toThrow('не найден');
  });
  it('отправляет текст правильным методом', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ idMessage: 'sent1' })));
    vi.stubGlobal('fetch', fetch);
    expect(await api.sendMessage('123456789012345@lid', 'Привет')).toBe('sent1');
    expect(fetch.mock.calls[0][0]).toContain('/sendMessage/');
    expect(fetch.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      chatId: '123456789012345@lid',
      message: 'Привет',
    });
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
