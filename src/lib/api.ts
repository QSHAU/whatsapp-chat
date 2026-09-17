import type { Credentials, Notification } from '../types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function normalizeApiUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('Укажите корректный apiUrl из кабинета GREEN-API.');
  }
  if (
    url.protocol !== 'https:' ||
    !/^(?:[a-z0-9-]+\.)*green-api\.com$/.test(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    !['/', '', '/v3', '/v3/'].includes(url.pathname)
  ) {
    throw new Error(
      'Нужен HTTPS-адрес сервера GREEN-API, например https://3100.api.green-api.com.',
    );
  }
  return url.origin;
}

export function normalizePhone(raw: string): string {
  if (!/^[+\d\s()-]+$/.test(raw))
    throw new Error('Введите номер телефона, используя цифры и код страны.');
  let phone = raw.replace(/\D/g, '');
  if (phone.length === 11 && phone.startsWith('8')) phone = '7' + phone.slice(1);
  if (!/^(7\d{10}|375\d{9})$/.test(phone))
    throw new Error('Введите номер РФ (+7, 11 цифр) или Беларуси (+375, 12 цифр).');
  return phone;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Что-то пошло не так. Попробуйте ещё раз.';
}

export class GreenApi {
  private readonly base: string;
  constructor(private readonly credentials: Credentials) {
    this.base = `${normalizeApiUrl(credentials.apiUrl)}/waInstance${encodeURIComponent(credentials.idInstance)}`;
  }
  private async request<T>(
    method: string,
    verb: string,
    body?: unknown,
    signal?: AbortSignal,
    suffix = '',
  ): Promise<T> {
    const timeout = AbortSignal.timeout(40000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await fetch(
        `${this.base}/${method}/${encodeURIComponent(this.credentials.apiTokenInstance)}${suffix}`,
        {
          method: verb,
          signal: combined,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          cache: 'no-store',
          ...(body === undefined
            ? {}
            : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        },
      );
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ApiError(
        timeout.aborted
          ? 'Сервер не ответил вовремя. Проверьте соединение.'
          : 'Не удалось связаться с GREEN-API. Проверьте интернет и apiUrl.',
      );
    }
    if (!response.ok) {
      // Не показываем сырые ответы сервера: они могут содержать ключ из URL.
      const messages: Record<number, string> = {
        400: 'GREEN-API отклонил запрос. Проверьте данные и настройки уведомлений.',
        401: 'Неверные данные подключения. Проверьте idInstance и apiTokenInstance.',
        403: 'Доступ запрещён. Проверьте токен, тариф и ограничения аккаунта.',
        404: 'Инстанс не найден. Проверьте idInstance и apiUrl.',
        429: 'Слишком много запросов. Подождите немного.',
        466: 'Превышен лимит тарифа GREEN-API.',
        469: 'MAX временно ограничил проверку номеров. Попробуйте позже.',
      };
      throw new ApiError(
        messages[response.status] ?? `Ошибка GREEN-API (${response.status}). Попробуйте позже.`,
        response.status,
      );
    }
    const text = await response.text();
    try {
      return (text ? JSON.parse(text) : null) as T;
    } catch {
      throw new ApiError('GREEN-API вернул некорректный ответ.');
    }
  }
  getState(signal?: AbortSignal) {
    return this.request<{ stateInstance: string }>('getStateInstance', 'GET', undefined, signal);
  }
  getSettings(signal?: AbortSignal) {
    return this.request<{ webhookUrl?: string; incomingWebhook?: string }>(
      'getSettings',
      'GET',
      undefined,
      signal,
    );
  }
  async checkAccount(phone: string, signal?: AbortSignal): Promise<string> {
    const result = await this.request<{ exist?: boolean; chatId?: string; status?: boolean }>(
      'checkAccount',
      'POST',
      { phoneNumber: Number(phone) },
      signal,
    );
    if (result?.status === false)
      throw new ApiError(
        'Не удалось проверить номер. Проверьте состояние инстанса и лимиты GREEN-API.',
      );
    if (!result?.exist || !result.chatId)
      throw new ApiError(
        'Аккаунт MAX не найден или скрыт настройками приватности. Проверьте номер.',
      );
    return String(result.chatId);
  }
  async sendMessage(chatId: string, message: string, signal?: AbortSignal) {
    const result = await this.request<{ idMessage: string }>(
      'sendMessage',
      'POST',
      { chatId, message },
      signal,
    );
    if (!result?.idMessage)
      throw new ApiError('Сервер не подтвердил отправку. Проверьте чат в MAX перед повтором.');
    return String(result.idMessage);
  }
  receive(signal: AbortSignal) {
    return this.request<Notification | null>(
      'receiveNotification',
      'GET',
      undefined,
      signal,
      '?receiveTimeout=25',
    );
  }
  async acknowledge(receiptId: number, signal: AbortSignal) {
    if (!Number.isSafeInteger(receiptId))
      throw new ApiError('Некорректный идентификатор уведомления.');
    await this.request('deleteNotification', 'DELETE', undefined, signal, `/${receiptId}`);
  }
}
