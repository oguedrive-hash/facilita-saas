/**
 * Tipos do payload do Chatwoot webhook.
 * Baseado nos webhooks reais observados em produção (event: message_created).
 */

export type ChatwootEvent =
  | "message_created"
  | "message_updated"
  | "conversation_created"
  | "conversation_updated"
  | "conversation_status_changed";

export type ChatwootContentType = "text" | "audio" | "image" | "file" | "video";

export type ChatwootSender = {
  id: number;
  name: string;
  phone_number: string;
  identifier: string; // ex: "5519998744971@s.whatsapp.net"
  email: string | null;
  type?: "contact" | "user";
  thumbnail?: string;
  blocked?: boolean;
};

export type ChatwootAttachment = {
  id: number;
  message_id: number;
  file_type: "audio" | "image" | "file" | "video";
  data_url: string;
  thumb_url: string;
  file_size: number;
  account_id: number;
  extension: string | null;
  width: number | null;
  height: number | null;
  transcribed_text: string;
};

export type ChatwootConversation = {
  id: number;
  inbox_id: number;
  status: "open" | "resolved" | "pending" | "snoozed";
  channel: string;
  contact_inbox: { source_id: string; contact_id: number; inbox_id: number };
  meta?: {
    sender?: ChatwootSender;
  };
};

/**
 * Payload de webhook `message_created` do Chatwoot.
 * Estrutura plana (event no nível raiz do body).
 */
export type ChatwootWebhookMessageCreated = {
  event: "message_created";
  id: number; // ID da mensagem
  content: string | null;
  content_type: ChatwootContentType;
  message_type: "incoming" | "outgoing";
  conversation: ChatwootConversation;
  sender: ChatwootSender;
  attachments?: ChatwootAttachment[];
  source_id?: string; // ex: "WAID:..."
  private?: boolean;
  account: {
    id: number;
    name: string;
  };
};

export type ChatwootWebhook =
  | ChatwootWebhookMessageCreated
  | { event: ChatwootEvent; [key: string]: unknown };

/**
 * Status simplificado do processamento de uma mensagem.
 */
export type ProcessingDecision =
  | { action: "ignore"; reason: string }
  | { action: "shadow_log"; reason: string }
  | { action: "process"; lead_id?: string };
