import { describe, it, expect } from 'vitest';
import { chatReducer, initialState, type ChatState } from './chat-state';
import type { Webhook } from '../types';

const incoming: Webhook = {
  typeWebhook: 'incomingMessageReceived',
  idMessage: 'msg1',
  timestamp: 1700000000,
  senderData: { chatId: '79991234567@c.us', senderName: 'Анна' },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
};
const started: ChatState = {
  ...initialState,
  chats: [
    {
      id: '79991234567@c.us',
      phone: '79991234567',
      name: '+7 999 123-45-67',
      messages: [],
      unread: 0,
    },
  ],
  selectedId: '79991234567@c.us',
};
describe('Состояние чата', () => {
  it('сопоставляет входящий ответ с существующим WhatsApp chatId и обновляет имя', () => {
    const state = chatReducer(started, { type: 'notification', body: incoming });
    expect(state.chats).toHaveLength(1);
    expect(state.chats[0].name).toBe('Анна');
    expect(state.chats[0].messages[0].text).toBe('Привет');
    expect(state.chats[0].unread).toBe(0);
    const lidState: ChatState = {
      ...started,
      chats: [{ ...started.chats[0], id: '123456789012345@lid' }],
      selectedId: '123456789012345@lid',
    };
    for (const chatId of ['123456789012345@lid', '79991234567@c.us']) {
      const reply = chatReducer(lidState, {
        type: 'notification',
        body: { ...incoming, senderData: { ...incoming.senderData, chatId } },
      });
      expect(reply.chats).toHaveLength(1);
      expect(reply.chats[0].messages[0].text).toBe('Привет');
      expect(reply.chats[0].unread).toBe(0);
    }
  });
  it('не дублирует повторно доставленное уведомление', () => {
    const state = chatReducer(initialState, { type: 'notification', body: incoming });
    expect(chatReducer(state, { type: 'notification', body: incoming })).toBe(state);
    expect(state.chats[0].unread).toBe(1);
  });
  it('сбрасывает непрочитанные при выборе чата', () => {
    const state = chatReducer(initialState, { type: 'notification', body: incoming });
    expect(chatReducer(state, { type: 'select', id: '79991234567@c.us' }).chats[0].unread).toBe(0);
  });
  it('игнорирует медиа и групповые чаты', () => {
    expect(
      chatReducer(started, {
        type: 'notification',
        body: { ...incoming, messageData: { typeMessage: 'imageMessage' } },
      }),
    ).toBe(started);
    expect(
      chatReducer(started, {
        type: 'notification',
        body: { ...incoming, senderData: { chatId: '120363043968066561@g.us' } },
      }),
    ).toBe(started);
  });
  it('поддерживает текст с URL', () => {
    const state = chatReducer(started, {
      type: 'notification',
      body: {
        ...incoming,
        messageData: {
          typeMessage: 'extendedTextMessage',
          extendedTextMessageData: { text: 'https://example.com' },
        },
      },
    });
    expect(state.chats[0].messages[0].text).toBe('https://example.com');
  });
  it('сохраняет статус, который пришёл раньше ответа sendMessage', () => {
    let state = chatReducer(started, {
      type: 'append',
      chatId: '79991234567@c.us',
      message: { id: 'local', direction: 'out', text: 'Тест', timestamp: 1, status: 'sending' },
    });
    state = chatReducer(state, {
      type: 'notification',
      body: { typeWebhook: 'outgoingMessageStatus', idMessage: 'server', status: 'read' },
    });
    state = chatReducer(state, {
      type: 'sent',
      chatId: '79991234567@c.us',
      localId: 'local',
      serverId: 'server',
    });
    expect(state.chats[0].messages[0].status).toBe('read');
    state = chatReducer(state, {
      type: 'notification',
      body: { typeWebhook: 'outgoingMessageStatus', idMessage: 'server', status: 'sent' },
    });
    expect(state.chats[0].messages[0].status).toBe('read');
  });
  it('не создаёт второй чат при повторном вводе номера', () => {
    const state = chatReducer(started, {
      type: 'addChat',
      chat: {
        id: '79991234567@c.us',
        phone: '79991234567',
        name: 'Новый',
        messages: [],
        unread: 0,
      },
    });
    expect(state.chats).toHaveLength(1);
  });
});
