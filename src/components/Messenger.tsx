import { useEffect, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  CircleAlert,
  Clock3,
  Info,
  LoaderCircle,
  LogOut,
  MessageCircle,
  MessageSquarePlus,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Smile,
  WifiOff,
  X,
} from 'lucide-react';
import { useMessenger } from '../hooks/useMessenger';
import { errorMessage } from '../lib/api';
import { formatPhone } from '../lib/chat-state';
import type { Chat, Credentials, Message } from '../types';
import { Dialog } from './Dialog';
import { registerNewChatTool } from '../lib/webmcp';

const time = (timestamp: number) =>
  new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(timestamp);
function dateLabel(timestamp: number) {
  if (new Date(timestamp).toDateString() === new Date().toDateString()) return 'Сегодня';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(timestamp);
}
function Avatar({ chat }: { chat: Chat }) {
  const initials = chat.name.startsWith('+')
    ? (chat.phone?.slice(-2) ?? 'М')
    : chat.name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('');
  const color = Array.from(chat.id).reduce((sum, s) => sum + s.charCodeAt(0), 0) % 5;
  return <span className={`avatar color-${color}`}>{initials}</span>;
}
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
      title={labels[message.status]}
      aria-label={labels[message.status]}
      className={`delivery ${message.status}`}
    >
      {message.status === 'sending' ? (
        <Clock3 size={13} />
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
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<'new' | 'info' | 'logout' | null>(null);
  const [phone, setPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const active = messenger.chats.find((c) => c.id === messenger.selectedId);
  const draft = active ? (drafts[active.id] ?? '') : '';
  const ordered = [...messenger.chats].sort(
    (a, b) => (b.messages.at(-1)?.timestamp ?? 0) - (a.messages.at(-1)?.timestamp ?? 0),
  );
  const filtered = ordered.filter((c) =>
    `${c.name} ${c.phone ?? ''}`.toLowerCase().includes(query.toLowerCase()),
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
    setAwayFromBottom(false);
  };
  useEffect(() => {
    scrollDown();
    setEmojiOpen(false);
    textarea.current?.focus();
  }, [active?.id]);
  useEffect(() => {
    if (!awayFromBottom) scrollDown();
  }, [active?.messages.length, awayFromBottom]);
  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = 'auto';
      const height = textarea.current.scrollHeight;
      textarea.current.style.height = `${Math.min(height, 150)}px`;
      textarea.current.style.overflowY = height > 150 ? 'auto' : 'hidden';
    }
  }, [draft]);
  async function create(event: FormEvent) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setCreateError('');
    try {
      await messenger.createChat(phone);
      setDialog(null);
      setQuery('');
    } catch (error) {
      setCreateError(errorMessage(error));
    } finally {
      setCreating(false);
    }
  }
  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (!active || messenger.sending || !draft.trim() || draft.trim().length > 4000) return;
    const id = active.id;
    setDrafts((prev) => ({ ...prev, [id]: '' }));
    setEmojiOpen(false);
    scrollDown();
    await messenger.send(draft);
  }
  return (
    <main className={`messenger ${active ? 'chat-open' : ''}`}>
      <aside className="chat-sidebar">
        {messenger.connectionError && (
          <div className="connection-banner sidebar-connection-banner" role="status">
            <WifiOff size={17} />
            <span>{messenger.connectionError}</span>
            <button onClick={messenger.reconnect}>Повторить</button>
          </div>
        )}
        <div className="sidebar-heading">
          <div className="brand">
            <span className="brand-mark">
              <Activity size={24} />
            </span>
            <span>
              пульс<span className="brand-dot">.</span>
            </span>
            <span className="max-badge">для MAX</span>
          </div>
        </div>
        <div className="sidebar-title">
          <h1>
            Сообщения <span>{messenger.chats.length || ''}</span>
          </h1>
          <button
            className="icon-button new-chat-button"
            aria-label="Новый чат"
            title="Новый чат"
            onClick={openNew}
          >
            <Plus size={23} />
          </button>
        </div>
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="Поиск чатов"
            placeholder="Поиск по чатам"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="icon-button"
              aria-label="Очистить поиск"
              onClick={() => setQuery('')}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="chat-list" aria-label="Чаты">
          {filtered.length ? (
            filtered.map((chat) => (
              <button
                key={chat.id}
                className={`chat-item ${active?.id === chat.id ? 'selected' : ''}`}
                onClick={() => messenger.select(chat.id)}
                aria-current={active?.id === chat.id ? 'true' : undefined}
              >
                <Avatar chat={chat} />
                <span className="chat-item-copy">
                  <span className="chat-item-top">
                    <strong>{chat.name}</strong>
                    <time>{chat.messages.at(-1) ? time(chat.messages.at(-1)!.timestamp) : ''}</time>
                  </span>
                  <span className="chat-item-bottom">
                    <span>
                      {chat.messages.at(-1)?.direction === 'out' && (
                        <span className="you">Вы: </span>
                      )}
                      {chat.messages.at(-1)?.text ?? 'Начните разговор'}
                    </span>
                    {chat.unread > 0 && <b className="unread">{chat.unread}</b>}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="sidebar-empty">
              <MessageCircle size={30} strokeWidth={1.5} />
              <strong>{query ? 'Ничего не найдено' : 'Здесь будут ваши чаты'}</strong>
              <p>
                {query ? 'Попробуйте другой запрос.' : 'Создайте первый чат по номеру телефона.'}
              </p>
              {!query && (
                <button className="text-button" onClick={openNew}>
                  Начать разговор <Plus size={15} />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="sidebar-footer">
          <span className="account-avatar">Я</span>
          <div>
            <strong>Мой аккаунт</strong>
            <span className="connection">
              <i className={messenger.connection === 'Подключено' ? 'connected' : ''} />
              {messenger.connection}
            </span>
          </div>
          <button
            className="icon-button"
            aria-label="Выйти из аккаунта"
            title="Выйти"
            onClick={() => setDialog('logout')}
          >
            <LogOut size={19} />
          </button>
        </div>
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
                <ArrowLeft size={21} />
              </button>
              <Avatar chat={active} />
              <div className="chat-header-copy">
                <h2>{active.name}</h2>
                <p>
                  {active.phone ? formatPhone(active.phone) : 'Личный чат'}
                  <span> · MAX</span>
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Информация о чате"
                title="Информация о чате"
                onClick={() => setDialog('info')}
              >
                <Info size={21} />
              </button>
            </header>
            {messenger.connectionError && (
              <div className="connection-banner" role="status">
                <WifiOff size={17} />
                <span>{messenger.connectionError}</span>
                <button onClick={messenger.reconnect}>Повторить</button>
              </div>
            )}
            <div
              className="message-area"
              ref={list}
              role="log"
              aria-label="Сообщения"
              aria-live="polite"
              aria-relevant="additions"
              onScroll={() => {
                const el = list.current;
                if (el) setAwayFromBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
              }}
            >
              <div className="conversation-start">
                <ShieldCheck size={14} /> Личный разговор в MAX
              </div>
              {!active.messages.length && (
                <div className="first-message">
                  <Avatar chat={active} />
                  <h3>Начните с «Привет»</h3>
                  <p>
                    Напишите первое сообщение.
                    <br />
                    Ответ появится здесь автоматически.
                  </p>
                </div>
              )}
              {active.messages.map((message, i) => (
                <div className="message-group" key={message.id}>
                  {(i === 0 ||
                    new Date(active.messages[i - 1].timestamp).toDateString() !==
                      new Date(message.timestamp).toDateString()) && (
                    <div className="date-divider">
                      <span>{dateLabel(message.timestamp)}</span>
                    </div>
                  )}
                  <div
                    className={`message-row ${message.direction === 'out' ? 'outgoing' : 'incoming'}`}
                  >
                    <div
                      className={`message-bubble ${['failed', 'unknown'].includes(message.status) ? 'message-problem' : ''}`}
                    >
                      <p>{message.text}</p>
                      <div className="message-meta">
                        <time>{time(message.timestamp)}</time>
                        <Delivery message={message} />
                      </div>
                      {['failed', 'unknown'].includes(message.status) && (
                        <div className="send-error">
                          <span>
                            {message.status === 'unknown'
                              ? 'Отправка не подтверждена. Проверьте MAX перед повтором.'
                              : (message.error ?? 'Не удалось доставить сообщение.')}
                          </span>
                          <button
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
            {awayFromBottom && (
              <button
                className="scroll-down icon-button"
                aria-label="К последним сообщениям"
                onClick={scrollDown}
              >
                <ArrowDown size={20} />
              </button>
            )}
            <div className="composer-wrap">
              {emojiOpen && (
                <div className="emoji-picker" aria-label="Эмодзи">
                  {['👋', '😊', '❤️', '👍', '🎉', '✨', '🙏', '🔥'].map((emoji) => (
                    <button
                      key={emoji}
                      aria-label={`Добавить ${emoji}`}
                      onClick={() => {
                        setDrafts((prev) => ({
                          ...prev,
                          [active.id]: (prev[active.id] ?? '') + emoji,
                        }));
                        setEmojiOpen(false);
                        textarea.current?.focus();
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <form className="composer" onSubmit={send}>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Выбрать эмодзи"
                  aria-expanded={emojiOpen}
                  onClick={() => setEmojiOpen(!emojiOpen)}
                >
                  <Smile size={23} />
                </button>
                <textarea
                  ref={textarea}
                  rows={1}
                  aria-label="Текст сообщения"
                  placeholder="Написать сообщение…"
                  value={draft}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [active.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send();
                    }
                    if (e.key === 'Escape') setEmojiOpen(false);
                  }}
                />
                <button
                  className="send-button"
                  type="submit"
                  aria-label="Отправить сообщение"
                  disabled={!draft.trim() || draft.trim().length > 4000 || messenger.sending}
                >
                  {messenger.sending ? (
                    <LoaderCircle className="spin" size={21} />
                  ) : (
                    <Send size={21} />
                  )}
                </button>
              </form>
              <div className="composer-hint">
                <span>
                  Enter — отправить <span className="hint-dot">·</span> Shift + Enter — новая строка
                </span>
                <span className={draft.trim().length > 4000 ? 'over-limit' : ''}>
                  {draft.length > 3500 ? `${draft.trim().length} / 4000` : 'Текстовые сообщения'}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="empty-header">
              <span>Личные сообщения</span>
              <span className="service-badge">MAX × GREEN-API</span>
            </header>
            {messenger.connectionError && (
              <div className="connection-banner" role="status">
                <WifiOff size={17} />
                <span>{messenger.connectionError}</span>
                <button onClick={messenger.reconnect}>Повторить</button>
              </div>
            )}
            <div className="workspace-empty">
              <span className="empty-icon">
                <MessageCircle size={43} strokeWidth={1.6} />
              </span>
              <span className="eyebrow">НА СВЯЗИ С БЛИЗКИМИ</span>
              <h2>
                Хороший разговор
                <br />
                начинается с «Привет»
              </h2>
              <p>
                Выберите чат слева или начните новый —<br />
                достаточно номера телефона.
              </p>
              <button className="primary-button" onClick={openNew}>
                <MessageSquarePlus size={19} /> Новый разговор
              </button>
              <div className="empty-footnote">Сообщения отправляются в MAX</div>
            </div>
          </>
        )}
      </section>
      {dialog === 'new' && (
        <Dialog
          title="Новый разговор"
          onClose={() => {
            if (!creating) setDialog(null);
          }}
        >
          <p className="muted">Введите номер человека, которому хотите написать в MAX.</p>
          <form onSubmit={create} className="new-chat-form">
            <label htmlFor="recipient">Номер телефона</label>
            <input
              id="recipient"
              type="tel"
              autoComplete="tel"
              autoFocus
              placeholder="+7 999 123-45-67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={creating}
            />
            <small>Россия (+7) или Беларусь (+375)</small>
            {createError && (
              <div className="error-box" role="alert">
                {createError}
              </div>
            )}
            <button className="primary-button" disabled={creating || !phone.trim()}>
              {creating ? (
                <>
                  <LoaderCircle className="spin" size={18} /> Проверяем номер…
                </>
              ) : (
                <>
                  Начать разговор <ArrowUpRight size={18} />
                </>
              )}
            </button>
          </form>
        </Dialog>
      )}
      {dialog === 'info' && active && (
        <Dialog title="О чате" onClose={() => setDialog(null)}>
          <div className="contact-detail">
            <Avatar chat={active} />
            <h3>{active.name}</h3>
            <p>{active.phone ? formatPhone(active.phone) : 'Личный чат MAX'}</p>
          </div>
          <dl className="info-list">
            <div>
              <dt>Сообщений в этой сессии</dt>
              <dd>{active.messages.length}</dd>
            </div>
            <div>
              <dt>Тип сообщений</dt>
              <dd>Текст</dd>
            </div>
          </dl>
          <p className="dialog-note">
            История хранится в памяти вкладки. После обновления страницы нужно подключиться заново.
            Полная переписка остаётся в MAX.
          </p>
        </Dialog>
      )}
      {dialog === 'logout' && (
        <Dialog title="Выйти из аккаунта?" onClose={() => setDialog(null)}>
          <p className="muted">
            Ключ доступа и переписка будут удалены из памяти этой вкладки. Сообщения в MAX
            сохранятся.
          </p>
          <div className="dialog-actions">
            <button className="secondary-button" onClick={() => setDialog(null)}>
              Остаться
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
