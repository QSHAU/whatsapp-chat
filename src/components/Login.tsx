import { useEffect, useRef, useState, type FormEvent } from 'react';
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
  async function connect(event: FormEvent) {
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
          'Подключите аккаунт MAX в кабинете GREEN-API и дождитесь состояния «Авторизован».',
        );
      const settings = await api.getSettings(controller.current.signal);
      if (settings?.webhookUrl || settings?.incomingWebhook !== 'yes')
        throw new Error(
          'В настройках GREEN-API включите входящие уведомления и очистите Webhook URL. Затем подождите минуту и повторите вход.',
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
        <h1 id="login-title">Чат для MAX</h1>
        <p className="muted">Подключение через GREEN-API</p>
        <form onSubmit={connect} className="stack-form">
          <label htmlFor="instance">ID инстанса (idInstance)</label>
          <input
            id="instance"
            inputMode="numeric"
            autoComplete="off"
            placeholder="3100000001"
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
            placeholder="https://3100.api.green-api.com"
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
            <li>Авторизуйте инстанс MAX в GREEN-API.</li>
            <li>Включите уведомления о входящих сообщениях.</li>
            <li>Оставьте Webhook URL пустым и подождите около минуты.</li>
          </ol>
        </details>
      </section>
    </main>
  );
}
