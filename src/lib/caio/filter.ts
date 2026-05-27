import type {
  ChatwootWebhook,
  ChatwootWebhookMessageCreated,
  ProcessingDecision,
} from "./types";

/**
 * Decide se o webhook do Chatwoot deve ser processado.
 *
 * Aceita: message_created (incoming e outgoing), sem ser private,
 * sem etiqueta `agente-off`.
 *
 * A direção (entrada/saída) é decidida pelo handler, não aqui.
 */
export function filterWebhook(
  webhook: ChatwootWebhook,
  conversationLabels: string[] = [],
): ProcessingDecision {
  if (webhook.event !== "message_created") {
    return {
      action: "ignore",
      reason: `event=${webhook.event} não é message_created`,
    };
  }

  const msg = webhook as ChatwootWebhookMessageCreated;

  if (msg.private) {
    return { action: "ignore", reason: "mensagem privada (anotação)" };
  }

  if (conversationLabels.includes("agente-off")) {
    return {
      action: "ignore",
      reason: "conversa marcada com etiqueta 'agente-off' (humano assumiu)",
    };
  }

  return { action: "process" };
}
