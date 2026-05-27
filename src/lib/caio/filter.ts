import type {
  ChatwootWebhook,
  ProcessingDecision,
} from "./types";

/**
 * Aceita eventos que contêm mensagens (diretamente ou aninhadas):
 * - message_created, message_updated → body é a mensagem
 * - conversation_created, conversation_updated → body tem messages[]
 *
 * Em integrações WhatsApp/Evolution o Chatwoot 4.11 só dispara
 * conversation_updated, então rejeitar tudo que não é message_created
 * (como fazíamos antes) descarta praticamente todas mensagens.
 *
 * O dedup pelo unique constraint em chatwoot_message_id evita gravar
 * a mesma mensagem 2x quando ela aparece em múltiplos eventos.
 */
export function filterWebhook(
  webhook: ChatwootWebhook,
  conversationLabels: string[] = [],
): ProcessingDecision {
  const aceitos = new Set<string>([
    "message_created",
    "message_updated",
    "conversation_created",
    "conversation_updated",
  ]);

  if (!aceitos.has(webhook.event)) {
    return {
      action: "ignore",
      reason: `event=${webhook.event} não traz mensagem`,
    };
  }

  if (conversationLabels.includes("agente-off")) {
    return {
      action: "ignore",
      reason: "conversa marcada com etiqueta 'agente-off' (humano assumiu)",
    };
  }

  return { action: "process" };
}
