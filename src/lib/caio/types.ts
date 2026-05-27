/**
 * Tipos do payload do Chatwoot webhook.
 * Baseado nos webhooks reais observados em produção.
 *
 * Em integrações WhatsApp/Evolution o Chatwoot 4.11 dispara principalmente
 * `conversation_updated` (com `messages[]` aninhado), não `message_created`
 * separado. Por isso o handler precisa suportar ambos os formatos.
 */

export type ChatwootEvent =
  | "message_created"
  | "message_updated"
  | "conversation_created"
  | "conversation_updated"
  | "conversation_status_changed"
  | "contact_created"
  | "contact_updated"
  | "webwidget_triggered"
  | "conversation_typing_on"
  | "conversation_typing_off";

export type ChatwootContentType = "text" | "audio" | "image" | "file" | "video";

export type ChatwootSender = {
  id: number;
  name: string;
  phone_number: string;
  identifier: string;
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
  transcribed_text?: string;
};

export type ChatwootMessage = {
  id: number;
  content: string | null;
  content_type?: ChatwootContentType;
  message_type: "incoming" | "outgoing" | 0 | 1;
  conversation_id?: number;
  sender?: ChatwootSender;
  attachments?: ChatwootAttachment[];
  private?: boolean;
  created_at?: number | string;
  updated_at?: string;
};

export type ChatwootConversation = {
  id: number;
  inbox_id: number;
  status: "open" | "resolved" | "pending" | "snoozed";
  channel?: string;
  contact_inbox?: { source_id: string; contact_id: number; inbox_id: number };
  messages?: ChatwootMessage[];
  meta?: {
    sender?: ChatwootSender;
  };
};

/**
 * Payload de webhook `message_created` / `message_updated` — body é a mensagem.
 */
export type ChatwootWebhookMessageCreated = {
  event: "message_created" | "message_updated";
  id: number;
  content: string | null;
  content_type: ChatwootContentType;
  message_type: "incoming" | "outgoing";
  conversation: ChatwootConversation;
  sender: ChatwootSender;
  attachments?: ChatwootAttachment[];
  source_id?: string;
  private?: boolean;
  account: {
    id: number;
    name: string;
  };
};

/**
 * Payload de webhook `conversation_updated` / `conversation_created`.
 * Body é a conversa com `messages[]` aninhado.
 */
export type ChatwootWebhookConversationUpdated = {
  event: "conversation_updated" | "conversation_created";
  id: number; // ID da conversa
  inbox_id: number;
  status: "open" | "resolved" | "pending" | "snoozed";
  channel?: string;
  contact_inbox?: { source_id: string; contact_id: number; inbox_id: number };
  messages?: ChatwootMessage[];
  meta?: { sender?: ChatwootSender };
  additional_attributes?: Record<string, unknown>;
};

export type ChatwootWebhook =
  | ChatwootWebhookMessageCreated
  | ChatwootWebhookConversationUpdated
  | { event: ChatwootEvent; [key: string]: unknown };

/**
 * Status simplificado do processamento de uma mensagem.
 */
export type ProcessingDecision =
  | { action: "ignore"; reason: string }
  | { action: "shadow_log"; reason: string }
  | { action: "process"; lead_id?: string };

/**
 * Normaliza message_type que vem como number ou string do Chatwoot.
 * 0 = incoming, 1 = outgoing
 */
export function normalizeMessageType(
  type: ChatwootMessage["message_type"],
): "incoming" | "outgoing" {
  if (type === "incoming" || type === 0) return "incoming";
  return "outgoing";
}
