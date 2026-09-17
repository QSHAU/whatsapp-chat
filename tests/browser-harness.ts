// Только локальный стенд. Не входит в production build. Все запросы GREEN-API перехвачены.
import type { Notification } from '../src/types';
const realFetch = window.fetch.bind(window);
let receipt = 1;
let message = 1;
let queue: Notification[] = [];
const record: { method: string; body: unknown }[] = [];
window.fetch = async (input, init) => {
  const url = String(input);
  if (!url.includes('green-api.com/waInstance')) return realFetch(input, init);
  const method = url.split('/')[4];
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  record.push({ method, body });
  const respond = (data: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  if (url.includes('invalid-token-test')) return respond({}, 401);
  if (method === 'getStateInstance') return respond({ stateInstance: 'authorized' });
  if (method === 'getSettings') return respond({ incomingWebhook: 'yes', webhookUrl: '' });
  if (method === 'checkAccount')
    return respond({
      exist: !String(body.phoneNumber).endsWith('0000'),
      chatId: String(body.phoneNumber).endsWith('4567') ? '101' : '102',
    });
  if (method === 'sendMessage') {
    if (body.message === 'Ошибка') return respond({}, 500);
    const id = String(message++);
    queue.push({
      receiptId: receipt++,
      body: {
        typeWebhook: 'outgoingMessageStatus',
        idMessage: id,
        status: 'delivered',
        chatId: body.chatId,
      },
    });
    setTimeout(() => {
      queue.push({
        receiptId: receipt++,
        body: {
          typeWebhook: 'incomingMessageReceived',
          idMessage: `reply-${id}`,
          timestamp: Math.floor(Date.now() / 1000),
          senderData: {
            chatId: body.chatId,
            senderName: body.chatId === '101' ? 'Анна Смирнова' : 'Михаил Волков',
            chatType: 'user',
          },
          messageData: {
            typeMessage: 'textMessage',
            textMessageData: { textMessage: 'Привет! Сообщение получила. Всё работает ✨' },
          },
        },
      });
    }, 700);
    return respond({ idMessage: id });
  }
  if (method === 'receiveNotification') {
    await new Promise<void>((resolve, reject) => {
      const signal = init?.signal;
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        resolve();
      }, 400);
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    });
    return respond(queue[0] ?? null);
  }
  if (method === 'deleteNotification') {
    queue = queue.filter((n) => n.receiptId !== Number(url.split('/').at(-1)));
    return respond({ result: true });
  }
  return respond({}, 404);
};
document.title = 'Пульс — тестовый API (без реальных отправок)';
await import('../src/main');
