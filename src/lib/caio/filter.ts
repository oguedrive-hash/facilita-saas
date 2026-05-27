import type {
  ChatwootWebhook,
  ChatwootWebhookMessageCreated,
  ProcessingDecision,
} from "./types";

/**
 * Decide se o webhook do Chatwoot deve ser processado pelo Caio.
 * Replica os filtros do n8n (Se inicial + Switch tipo de mensagem):
 *
 * - event = message_created
 * - message_type = incoming (lead enviou, não o bot)
 * - content_type = text OU attachment.file_type = audio
 * - conversation NÃO tem etiqueta `agente-off`
 *
 * Retorna o que fazer com esse webhook.
 */
export function filterWebhook(
  webhook: ChatwootWebhook,
  conversationLabels: string[] = [],
): ProcessingDecision {
  // Não é evento de mensagem criada
  if (webhook.event !== "message_created") {
    return {
      action: "ignore",
      reason: `event=${webhook.event} não é message_created`,
    };
  }

  const msg = webhook as ChatwootWebhookMessageCreated;

  // Bot mandou (outgoing) — não processar
  if (msg.message_type !== "incoming") {
    return {
      action: "ignore",
      reason: `message_type=${msg.message_type} não é incoming`,
    };
  }

  // Mensagem privada (anotações internas) — ignorar
  if (msg.private) {
    return { action: "ignore", reason: "mensagem privada (anotação)" };
  }

  // Conversa marcada como agente-off — humano assumiu
  if (conversationLabels.includes("agente-off")) {
    return {
      action: "ignore",
      reason: "conversa marcada com etiqueta 'agente-off' (humano assumiu)",
    };
  }

  // Áudio sem URL — não dá pra transcrever
  const hasAudioAttachment =
    msg.attachments?.[0]?.file_type === "audio";
  const hasText = msg.content && msg.content.trim().length > 0;

  if (!hasText && !hasAudioAttachment) {
    return {
      action: "ignore",
      reason: "sem conteúdo textual nem áudio (provavelmente imagem/file)",
    };
  }

  // Passou em todos os filtros — processar
  return { action: "process" };
}
