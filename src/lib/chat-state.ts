import type { Chat, Message, MessageStatus, Webhook } from '../types';

export interface ChatState {
  chats: Chat[];
  selectedId: string | null;
  statuses: Record<string, MessageStatus>;
}
export const initialState: ChatState = { chats: [], selectedId: null, statuses: {} };
export type ChatAction =
  | { type: 'select'; id: string | null }
  | { type: 'addChat'; chat: Chat }
  | { type: 'append'; chatId: string; message: Message }
  | { type: 'sent'; chatId: string; localId: string; serverId: string }
  | { type: 'failed'; chatId: string; id: string; error: string; uncertain: boolean }
  | { type: 'notification'; body: Webhook };

const ranks: Record<MessageStatus, number> = {
  sending: 0,
  unknown: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: -1,
};
function advance(previous: MessageStatus, next: MessageStatus) {
  return next === 'failed' ? next : ranks[next] >= ranks[previous] ? next : previous;
}
function updateChat(state: ChatState, id: string, update: (chat: Chat) => Chat): ChatState {
  return { ...state, chats: state.chats.map((chat) => (chat.id === id ? update(chat) : chat)) };
}
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'select':
      return {
        ...state,
        selectedId: action.id,
        chats: state.chats.map((c) => (c.id === action.id ? { ...c, unread: 0 } : c)),
      };
    case 'addChat': {
      const existing = state.chats.find((c) => c.id === action.chat.id);
      return {
        ...state,
        selectedId: action.chat.id,
        chats: existing
          ? state.chats.map((c) =>
              c.id === existing.id ? { ...c, phone: action.chat.phone ?? c.phone, unread: 0 } : c,
            )
          : [...state.chats, action.chat],
      };
    }
    case 'append':
      return updateChat(state, action.chatId, (chat) => ({
        ...chat,
        messages: [...chat.messages, action.message],
      }));
    case 'sent':
      return updateChat(state, action.chatId, (chat) => {
        const echoed = chat.messages.find((m) => m.id === action.serverId);
        return {
          ...chat,
          messages: chat.messages
            .filter((m) => m.id !== action.serverId || m.id === action.localId)
            .map((m) =>
              m.id === action.localId
                ? {
                    ...m,
                    id: action.serverId,
                    status: state.statuses[action.serverId] ?? echoed?.status ?? 'sent',
                    error: undefined,
                  }
                : m,
            ),
        };
      });
    case 'failed':
      return updateChat(state, action.chatId, (chat) => ({
        ...chat,
        messages: chat.messages.map((m) =>
          m.id === action.id
            ? { ...m, status: action.uncertain ? 'unknown' : 'failed', error: action.error }
            : m,
        ),
      }));
    case 'notification': {
      const body = action.body;
      if (
        body.typeWebhook === 'outgoingMessageStatus' &&
        body.idMessage &&
        ['sent', 'delivered', 'read', 'failed'].includes(body.status ?? '')
      ) {
        const status = body.status as MessageStatus;
        const next = advance(state.statuses[body.idMessage] ?? 'sending', status);
        const statuses = Object.fromEntries(
          [...Object.entries(state.statuses), [body.idMessage, next]].slice(-500),
        );
        return {
          ...state,
          statuses,
          chats: state.chats.map((c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === body.idMessage ? { ...m, status: advance(m.status, next) } : m,
            ),
          })),
        };
      }
      if (body.typeWebhook !== 'incomingMessageReceived') return state;
      const sender = body.senderData;
      const id = sender?.chatId;
      if (!id || !body.idMessage || !/^\d+@(c\.us|lid)$/.test(id)) return state;
      const data = body.messageData;
      const text =
        data?.typeMessage === 'textMessage'
          ? data.textMessageData?.textMessage
          : data?.typeMessage === 'extendedTextMessage'
            ? data.extendedTextMessageData?.text
            : undefined;
      if (typeof text !== 'string') return state;
      const phone = id.endsWith('@c.us') ? id.split('@')[0] : undefined;
      const existing = state.chats.find((c) => c.id === id || (phone && c.phone === phone));
      if (existing?.messages.some((m) => m.id === body.idMessage)) return state;
      const name =
        sender.senderContactName ||
        sender.senderName ||
        sender.chatName ||
        (phone ? `+${phone}` : `Собеседник ${id}`);
      const chat: Chat = existing ?? { id: String(id), phone, name, messages: [], unread: 0 };
      const message: Message = {
        id: body.idMessage,
        text,
        direction: 'in',
        status: 'delivered',
        timestamp: body.timestamp ? body.timestamp * 1000 : Date.now(),
      };
      const updated = {
        ...chat,
        name: chat.name.startsWith('+') ? name : chat.name,
        messages: [...chat.messages, message].sort((a, b) => a.timestamp - b.timestamp),
        unread: state.selectedId === chat.id ? 0 : chat.unread + 1,
      };
      return {
        ...state,
        chats: existing
          ? state.chats.map((c) => (c.id === chat.id ? updated : c))
          : [...state.chats, updated],
      };
    }
  }
}

export function formatPhone(phone: string): string {
  if (/^7\d{10}$/.test(phone))
    return `+7 ${phone.slice(1, 4)} ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`;
  return `+${phone}`;
}
