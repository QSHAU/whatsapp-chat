import { useEffect, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { ArrowLeft, Check, CheckCheck, CircleAlert, Clock3 } from 'lucide-react';
import { useMessenger } from '../hooks/useMessenger';
import { errorMessage } from '../lib/api';
import { formatPhone } from '../lib/chat-state';
import { registerNewChatTool } from '../lib/webmcp';
import type { Credentials, Message } from '../types';
import { Dialog } from './Dialog';

const time = (timestamp: number) =>
  new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(timestamp);
const dateLabel = (timestamp: number) =>
  new Date(timestamp).toDateString() === new Date().toDateString()
    ? 'Сегодня'
    : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(timestamp);

function Delivery({ message }: { message: Message }) {
  if (message.direction === 'in') return null;
  const labels = {
    sending: 'Отправляется',
    sent: 'Принято GREEN-API',
    delivered: 'Доставлено',
    read: 'Прочитано',
    failed: 'Не отправлено',
    unknown: 'Отправка не подтверждена',
  };
  return (
    <span
      className={`delivery ${message.status}`}
      title={labels[message.status]}
      aria-label={labels[message.status]}
    >
      {message.status === 'sending' ? (
        <Clock3 size={14} />
      ) : ['failed', 'unknown'].includes(message.status) ? (
        <CircleAlert size={14} />
      ) : ['delivered', 'read'].includes(message.status) ? (
        <CheckCheck size={16} />
      ) : (
        <Check size={15} />
      )}
    </span>
  );
}

export function Messenger({
  credentials,
  onLogout,
}: {
  credentials: Credentials;
  onLogout: () => void;
}) {
  const messenger = useMessenger(credentials);
  const [dialog, setDialog] = useState<'new' | 'logout' | null>(null);
  const [phone, setPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const list = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const active = messenger.chats.find((chat) => chat.id === messenger.selectedId);
  const draft = active ? (drafts[active.id] ?? '') : '';
  const chats = [...messenger.chats].sort(
    (a, b) => (b.messages.at(-1)?.timestamp ?? 0) - (a.messages.at(-1)?.timestamp ?? 0),
  );

  const openNew = () => {
    setCreateError('');
    setPhone('');
    setDialog('new');
  };
  useEffect(
    () =>
      registerNewChatTool((phone) =>
        flushSync(() => {
          setCreateError('');
          setPhone(phone);
          setDialog('new');
        }),
      ),
    [],
  );
  const scrollDown = () => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  };
  useEffect(() => {
    nearBottom.current = true;
    scrollDown();
    textarea.current?.focus();
  }, [active?.id]);
  useEffect(() => {
    if (nearBottom.current) scrollDown();
  }, [active?.messages.length]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setCreateError('');
    try {
      await messenger.createChat(phone);
      setDialog(null);
    } catch (error) {
      setCreateError(errorMessage(error));
    } finally {
      setCreating(false);
    }
  }
  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (!active || messenger.sending || !draft.trim() || draft.trim().length > 20000) return;
    setDrafts((prev) => ({ ...prev, [active.id]: '' }));
    nearBottom.current = true;
    await messenger.send(draft);
  }
  const connectionBanner = messenger.connectionError && (
    <div className="connection-banner" role="status">
      <span>{messenger.connectionError}</span>
      <button className="text-button" onClick={messenger.reconnect}>
        Повторить
      </button>
    </div>
  );

  return (
    <main className={`messenger ${active ? 'chat-open' : ''}`}>
      <aside className="chat-sidebar">
        <header className="sidebar-header">
          <h1>Чаты</h1>
          <button className="primary-button" onClick={openNew}>
            Новый чат
          </button>
        </header>
        <div className="sidebar-banner">{connectionBanner}</div>
        <nav className="chat-list" aria-label="Чаты">
          {chats.length ? (
            chats.map((chat) => (
              <button
                key={chat.id}
                className={`chat-item ${active?.id === chat.id ? 'selected' : ''}`}
                onClick={() => messenger.select(chat.id)}
                aria-current={active?.id === chat.id ? 'true' : undefined}
              >
                <span className="chat-item-top">
                  <strong>{chat.name}</strong>
                  {chat.unread > 0 && <span className="unread">{chat.unread}</span>}
                </span>
                <span className="chat-preview">
                  {chat.messages.at(-1)?.direction === 'out' ? 'Вы: ' : ''}
                  {chat.messages.at(-1)?.text ?? 'Нет сообщений'}
                </span>
              </button>
            ))
          ) : (
            <div className="sidebar-empty">
              <strong>Начните переписку</strong>
              <p>
                Нажмите «Новый чат» и введите номер получателя. Существующие чаты и история из
                WhatsApp здесь не загружаются.
              </p>
              <p>
                Переписка в этом интерфейсе сохраняется только до обновления страницы или выхода.
                Сообщения в WhatsApp сохранятся.
              </p>
            </div>
          )}
        </nav>
        <footer className="sidebar-footer">
          <span className="connection" role="status">
            {messenger.connection}
          </span>
          <button className="text-button" onClick={() => setDialog('logout')}>
            Выйти
          </button>
        </footer>
      </aside>
      <section
        className="chat-workspace"
        aria-label={active ? `Переписка: ${active.name}` : 'Переписка'}
      >
        {active ? (
          <>
            <header className="chat-header">
              <button
                className="icon-button mobile-back"
                aria-label="Вернуться к чатам"
                onClick={() => messenger.select(null)}
              >
                <ArrowLeft size={22} />
              </button>
              <div>
                <h2>{active.name}</h2>
                {active.phone && <p>{formatPhone(active.phone)}</p>}
              </div>
            </header>
            {connectionBanner}
            <div
              className="message-area"
              ref={list}
              role="log"
              aria-label="Сообщения"
              aria-live="polite"
              aria-relevant="additions"
              onScroll={() => {
                const el = list.current;
                if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
              }}
            >
              {!active.messages.length && <p className="empty-messages">Сообщений пока нет</p>}
              {active.messages.map((message, i) => (
                <div key={message.id}>
                  {(i === 0 ||
                    new Date(active.messages[i - 1].timestamp).toDateString() !==
                      new Date(message.timestamp).toDateString()) && (
                    <div className="date-divider">{dateLabel(message.timestamp)}</div>
                  )}
                  <div
                    className={`message-row ${message.direction === 'out' ? 'outgoing' : 'incoming'}`}
                  >
                    <div className="message-bubble">
                      <p>{message.text}</p>
                      <div className="message-meta">
                        <time>{time(message.timestamp)}</time>
                        <Delivery message={message} />
                      </div>
                      {['failed', 'unknown'].includes(message.status) && (
                        <div className="send-error">
                          <span>
                            {message.status === 'unknown'
                              ? 'Отправка не подтверждена. Проверьте WhatsApp перед повтором.'
                              : (message.error ?? 'Не удалось доставить сообщение.')}
                          </span>
                          <button
                            className="text-button"
                            onClick={() => {
                              setDrafts((prev) => ({ ...prev, [active.id]: message.text }));
                              textarea.current?.focus();
                            }}
                          >
                            Вернуть в поле ввода
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="composer-wrap">
              <form className="composer" onSubmit={send}>
                <textarea
                  ref={textarea}
                  rows={2}
                  aria-label="Текст сообщения"
                  placeholder="Сообщение"
                  value={draft}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [active.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <button
                  className="primary-button"
                  aria-label="Отправить сообщение"
                  disabled={!draft.trim() || draft.trim().length > 20000 || messenger.sending}
                >
                  {messenger.sending ? 'Отправка…' : 'Отправить'}
                </button>
              </form>
              <div className="composer-hint">
                <span>Enter — отправить, Shift + Enter — новая строка</span>
                {draft.trim().length > 19000 && (
                  <span className={draft.trim().length > 20000 ? 'over-limit' : ''}>
                    {draft.trim().length} / 20000
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {connectionBanner}
            <div className="workspace-empty">Выберите чат или создайте новый</div>
          </>
        )}
      </section>
      {dialog === 'new' && (
        <Dialog
          title="Новый чат"
          onClose={() => {
            if (!creating) setDialog(null);
          }}
        >
          <form onSubmit={create} className="stack-form">
            <label htmlFor="recipient">Номер телефона</label>
            <input
              id="recipient"
              type="tel"
              autoComplete="tel"
              placeholder="+7 999 123-45-67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={creating}
            />
            <small className="muted">Международный номер с кодом страны</small>
            {createError && (
              <p className="error-box" role="alert">
                {createError}
              </p>
            )}
            <button className="primary-button" disabled={creating || !phone.trim()}>
              {creating ? 'Проверяем номер…' : 'Создать чат'}
            </button>
          </form>
        </Dialog>
      )}
      {dialog === 'logout' && (
        <Dialog title="Выйти из аккаунта?" onClose={() => setDialog(null)}>
          <p className="muted">
            Ключ и переписка будут удалены из памяти вкладки. Сообщения в WhatsApp сохранятся.
          </p>
          <div className="dialog-actions">
            <button className="secondary-button" onClick={() => setDialog(null)}>
              Отмена
            </button>
            <button className="primary-button" onClick={onLogout}>
              Выйти
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
