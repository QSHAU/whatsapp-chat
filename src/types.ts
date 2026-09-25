export interface Credentials {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl: string;
}
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'unknown';
export interface Message {
  id: string;
  text: string;
  timestamp: number;
  direction: 'in' | 'out';
  status: MessageStatus;
  error?: string;
}
export interface Chat {
  id: string;
  phone?: string;
  name: string;
  messages: Message[];
  unread: number;
}
export interface Webhook {
  typeWebhook: string;
  idMessage?: string;
  timestamp?: number;
  senderData?: {
    chatId?: string;
    chatName?: string;
    senderName?: string;
    senderContactName?: string;
  };
  messageData?: {
    typeMessage?: string;
    textMessageData?: { textMessage?: string };
    extendedTextMessageData?: { text?: string };
  };
  chatId?: string;
  status?: string;
  stateInstance?: string;
}
export interface Notification {
  receiptId: number;
  body: Webhook;
}
