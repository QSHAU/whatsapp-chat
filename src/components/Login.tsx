import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { errorMessage, GreenApi, normalizeApiUrl } from '../lib/api';
import type { Credentials } from '../types';

export function Login({ onConnect }: { onConnect: (credentials: Credentials) => void }) {
  const [id, setId] = useState('');
  const [token, setToken] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function connect(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    try {
      if (!/^\d{6,20}$/.test(id.trim()))
        throw new Error('idInstance должен содержать от 6 до 20 цифр.');
      if (!/^[a-zA-Z0-9_-]{10,256}$/.test(token.trim()))
        throw new Error('Проверьте apiTokenInstance: скопируйте ключ целиком из кабинета.');
      const credentials = {
        idInstance: id.trim(),
        apiTokenInstance: token.trim(),
        apiUrl: normalizeApiUrl(url),
      };
      setBusy(true);
      controller.current = new AbortController();
      const api = new GreenApi(credentials);
      const state = await api.getState(controller.current.signal);
      if (state?.stateInstance !== 'authorized')
        throw new Error(
          'Подключите аккаунт WhatsApp в кабинете GREEN-API и дождитесь состояния «Авторизован».',
        );
      const settings = await api.getSettings(controller.current.signal);
      if (settings?.webhookUrl)
        throw new Error(
          'Откройте кабинет GREEN-API → выберите свой инстанс → настройки уведомлений. В поле «Адрес отправки уведомлений (URL)» (Webhook URL) удалите весь адрес и сохраните изменения. Подождите несколько минут и повторите вход.',
        );
      if (settings?.incomingWebhook !== 'yes')
        throw new Error(
          'Откройте кабинет GREEN-API → выберите свой инстанс → настройки уведомлений. Включите «Получать уведомления о входящих сообщениях и файлах» и сохраните изменения. Подождите несколько минут и повторите вход.',
        );
      onConnect(credentials);
    } catch (err) {
      if (!controller.current?.signal.aborted) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">Чат для WhatsApp</h1>
        <p className="muted">Подключение через GREEN-API</p>
        <form onSubmit={connect} className="stack-form">
          <label htmlFor="instance">ID инстанса (idInstance)</label>
          <input
            id="instance"
            inputMode="numeric"
            autoComplete="off"
            placeholder="1101000001"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
            disabled={busy}
          />
          <label htmlFor="token">Ключ доступа (apiTokenInstance)</label>
          <input
            id="token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            disabled={busy}
          />
          <label htmlFor="api-url">Адрес сервера (apiUrl)</label>
          <input
            id="api-url"
            type="url"
            autoComplete="url"
            placeholder="https://1101.api.green-api.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={busy}
          />
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? 'Подключение…' : 'Войти'}
          </button>
        </form>
        <p className="login-note">
          Данные — в{' '}
          <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">
            кабинете GREEN-API
          </a>
          . Ключ хранится только до выхода или обновления страницы.
        </p>
        <details className="setup-help">
          <summary>Настройка подключения</summary>
          <ol>
            <li>
              Создайте инстанс WhatsApp в GREEN-API и привяжите его через «Связанные устройства» в
              WhatsApp.
            </li>
            <li>
              В кабинете GREEN-API выберите свой инстанс и откройте настройки уведомлений. Включите
              «Получать уведомления о входящих сообщениях и файлах».
            </li>
            <li>
              Найдите поле «Адрес отправки уведомлений (URL)» (Webhook URL). Если в нём указан
              адрес, удалите его целиком. Если поле пустое, ничего менять не нужно.
            </li>
            <li>Сохраните изменения, подождите несколько минут и нажмите «Войти» здесь.</li>
          </ol>
        </details>
      </section>
    </main>
  );
}
