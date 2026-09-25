import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ApiError, errorMessage, GreenApi, normalizePhone } from '../lib/api';
import { chatReducer, formatPhone, initialState } from '../lib/chat-state';
import { pollNotifications } from '../lib/polling';
import type { Credentials } from '../types';

export function useMessenger(credentials: Credentials) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const [connection, setConnection] = useState('Подключение…');
  const [connectionError, setConnectionError] = useState('');
  const [restart, setRestart] = useState(0);
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false);
  const actionControllers = useRef(new Set<AbortController>());
  const api = useMemo(() => new GreenApi(credentials), [credentials]);
  useEffect(
    () => () => {
      for (const c of actionControllers.current) c.abort();
      actionControllers.current.clear();
    },
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    let waitingTimer: ReturnType<typeof setTimeout> | undefined;
    setConnection('Подключение…');
    setConnectionError('');
    let accountError = '';
    const run = async () => {
      await pollNotifications({
        api,
        signal: controller.signal,
        onNotification: (notification) => {
          if (notification.body.typeWebhook === 'stateInstanceChanged') {
            accountError =
              notification.body.stateInstance === 'authorized'
                ? ''
                : 'Аккаунт WhatsApp отключён или ограничен. Проверьте инстанс в GREEN-API.';
          }
          dispatch({ type: 'notification', body: notification.body });
        },
        onStatus: (error, stopped) => {
          setConnection(
            error
              ? stopped
                ? 'Нужно проверить подключение'
                : 'Восстанавливаем связь…'
              : accountError
                ? 'Аккаунт недоступен'
                : 'Подключено',
          );
          setConnectionError(error?.message ?? accountError);
        },
      });
    };
    if (navigator.locks) {
      waitingTimer = setTimeout(() => {
        setConnection('Ожидаем другую вкладку');
        setConnectionError(
          'Аккаунт используется в другой вкладке. Закройте её — подключение продолжится автоматически.',
        );
      }, 700);
      void navigator.locks
        .request(
          `pulse:${credentials.idInstance}`,
          { mode: 'exclusive', signal: controller.signal },
          async () => {
            clearTimeout(waitingTimer);
            if (controller.signal.aborted) return;
            setConnection('Подключено');
            setConnectionError('');
            await run();
          },
        )
        .catch(() => {
          clearTimeout(waitingTimer);
          if (!controller.signal.aborted) {
            setConnection('Нет подключения');
            setConnectionError('Не удалось запустить получение сообщений. Повторите подключение.');
          }
        });
    } else void run();
    return () => {
      clearTimeout(waitingTimer);
      controller.abort();
    };
  }, [api, credentials.idInstance, restart]);

  const createChat = useCallback(
    async (rawPhone: string) => {
      const phone = normalizePhone(rawPhone);
      const existing = state.chats.find((c) => c.phone === phone);
      if (existing) {
        dispatch({ type: 'select', id: existing.id });
        return;
      }
      const controller = new AbortController();
      actionControllers.current.add(controller);
      try {
        const id = await api.checkWhatsapp(phone, controller.signal);
        if (!controller.signal.aborted)
          dispatch({
            type: 'addChat',
            chat: { id, phone, name: formatPhone(phone), messages: [], unread: 0 },
          });
      } finally {
        actionControllers.current.delete(controller);
      }
    },
    [api, state.chats],
  );

  async function send(text: string) {
    const chatId = state.selectedId;
    const trimmed = text.trim();
    if (!chatId || !trimmed || trimmed.length > 20000 || sendLock.current) return false;
    sendLock.current = true;
    setSending(true);
    const localId = crypto.randomUUID();
    const controller = new AbortController();
    actionControllers.current.add(controller);
    dispatch({
      type: 'append',
      chatId,
      message: {
        id: localId,
        text: trimmed,
        timestamp: Date.now(),
        direction: 'out',
        status: 'sending',
      },
    });
    try {
      const serverId = await api.sendMessage(chatId, trimmed, controller.signal);
      if (!controller.signal.aborted) dispatch({ type: 'sent', chatId, localId, serverId });
    } catch (error) {
      if (!controller.signal.aborted)
        dispatch({
          type: 'failed',
          chatId,
          id: localId,
          error: errorMessage(error),
          uncertain: !(error instanceof ApiError) || error.status === 0 || error.status >= 500,
        });
    } finally {
      actionControllers.current.delete(controller);
      sendLock.current = false;
      setSending(false);
    }
    return true;
  }
  return {
    ...state,
    sending,
    connection,
    connectionError,
    createChat,
    send,
    select: (id: string | null) => dispatch({ type: 'select', id }),
    reconnect: () => setRestart((v) => v + 1),
  };
}
