import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { errorMessage, GreenApi, normalizeApiUrl } from '../lib/api';
import type { Credentials } from '../types';

export function Login({ onConnect }: { onConnect: (credentials: Credentials) => void }) {
  const [id, setId] = useState('');
  const [token, setToken] = useState('');
  const [url, setUrl] = useState('');
  const [visible, setVisible] = useState(false);
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
    <main className="login-layout">
      <section className="login-story">
        <a className="brand" href="/" aria-label="Пульс, главная">
          <span className="brand-mark">
            <Activity size={25} />
          </span>
          <span>
            пульс<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="story-main">
          <span className="eyebrow">ВАШ MAX. В НОВОМ РИТМЕ.</span>
          <h1>
            Ближе.
            <br />
            Даже на расстоянии.
          </h1>
          <p>
            Простой способ оставаться на связи.
            <br />
            Ваши разговоры в MAX — прямо здесь.
          </p>
          <div className="conversation-sample" aria-label="Пример интерфейса чата">
            <div className="sample-caption">ПРИМЕР РАЗГОВОРА</div>
            <div className="sample-row">
              <span className="avatar coral">А</span>
              <div className="sample-bubble">
                Привет! Ты на связи?<small>12:40</small>
              </div>
            </div>
            <div className="sample-row own">
              <div className="sample-bubble">
                Да, я здесь 👋
                <small>
                  12:41 <Check size={13} />
                </small>
              </div>
            </div>
            <div className="sample-row">
              <span className="avatar coral">А</span>
              <div className="sample-bubble">
                Тогда до встречи!<small>12:41</small>
              </div>
            </div>
          </div>
        </div>
        <div className="story-footer">
          <MessageCircle size={17} />
          <span>Только нужное. Только общение.</span>
          <span className="version">01 / WEB</span>
        </div>
      </section>
      <section className="login-content">
        <div className="login-top">
          <span>Клиент для MAX</span>
          <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">
            Кабинет GREEN-API <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="login-card">
          <div className="form-icon">
            <KeyRound size={26} />
          </div>
          <h2>Давайте подключимся</h2>
          <p className="muted">
            Введите данные вашего инстанса GREEN-API,
            <br className="desktop-break" /> чтобы начать разговор.
          </p>
          <form onSubmit={connect} className="login-form">
            <label htmlFor="instance">
              ID инстанса <span>idInstance</span>
            </label>
            <input
              id="instance"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Например, 3100000001"
              value={id}
              onChange={(e) => setId(e.target.value)}
              required
              disabled={busy}
            />
            <label htmlFor="token">
              Ключ доступа <span>apiTokenInstance</span>
            </label>
            <div className="password-field">
              <input
                id="token"
                type={visible ? 'text' : 'password'}
                autoComplete="off"
                placeholder="Ваш секретный ключ"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                disabled={busy}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={visible ? 'Скрыть ключ' : 'Показать ключ'}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            <label htmlFor="api-url">
              Адрес сервера <span>apiUrl</span>
            </label>
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
            <small className="field-hint">Все три значения находятся в карточке инстанса.</small>
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={18} /> Подключаемся…
                </>
              ) : (
                <>
                  Открыть мои чаты <ChevronRight size={19} />
                </>
              )}
            </button>
          </form>
          <div className="privacy-note">
            <LockKeyhole size={16} />
            <span>
              Ключ хранится только в памяти этой вкладки
              <br />и удаляется при выходе или обновлении страницы.
            </span>
          </div>
          <details className="setup-help">
            <summary>Как подготовить аккаунт?</summary>
            <ol>
              <li>Создайте инстанс MAX в GREEN-API и авторизуйте его.</li>
              <li>Включите «Получать уведомления о входящих сообщениях и файлах».</li>
              <li>Оставьте Webhook URL пустым. Изменения применяются примерно за минуту.</li>
              <li>Скопируйте idInstance, apiTokenInstance и apiUrl в поля выше.</li>
            </ol>
          </details>
        </div>
        <footer className="login-footer">
          <ShieldCheck size={16} /> Независимый клиент. Неофициальное приложение MAX.
        </footer>
      </section>
    </main>
  );
}
