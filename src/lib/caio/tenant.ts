import { createAdminClient } from "@/lib/supabase/admin";
import type { ChatwootWebhookMessageCreated } from "./types";

/**
 * Identifica qual cliente (organization) é dono dessa conversa.
 *
 * Estratégia: cada organização tem 1 `chatwoot_inbox_id` único.
 * O webhook traz o `conversation.inbox_id`, que mapeia 1:1 pra organization.
 *
 * Retorna `null` se nenhuma org encontrada (não deveria acontecer em produção,
 * mas em modo sombra pode acontecer enquanto o provisionamento não tá completo).
 */
export async function resolveOrganization(
  msg: ChatwootWebhookMessageCreated,
): Promise<{ id: string; name: string } | null> {
  const inboxId = msg.conversation?.inbox_id;
  if (!inboxId) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("chatwoot_inbox_id", inboxId)
    .eq("ativo", true)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Fallback temporário: enquanto o provisionamento automático não está pronto,
 * a Facilita (única org real) ainda não tem `chatwoot_inbox_id` setado.
 *
 * Esse helper retorna a Facilita por nome. Remover quando o provisionamento
 * configurar o inbox_id corretamente.
 */
export async function getFacilitaOrgFallback(): Promise<{
  id: string;
  name: string;
} | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("name", "Facilita")
    .single();

  if (error || !data) return null;
  return data;
}
