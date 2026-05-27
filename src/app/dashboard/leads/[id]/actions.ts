"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addLabel, enviarMensagem } from "@/lib/caio/chatwoot-api";

/**
 * Envia uma mensagem pelo painel respondendo um lead.
 *
 * Fluxo:
 * 1. Lê o lead no Supabase (usa cliente do usuário → respeita RLS por org)
 * 2. Envia a mensagem via Chatwoot API → vai pro WhatsApp
 * 3. Aplica etiqueta `agente-off` na conversa (Caio para de responder)
 * 4. Grava a mensagem no Supabase (admin client) pra UI atualizar imediato
 * 5. Revalida o cache da página
 */
export async function responderLead(formData: FormData): Promise<
  { ok: true } | { error: string }
> {
  const leadId = formData.get("leadId");
  const conteudo = formData.get("conteudo");

  if (typeof leadId !== "string" || !leadId) {
    return { error: "leadId ausente" };
  }
  if (typeof conteudo !== "string" || !conteudo.trim()) {
    return { error: "Escreve alguma coisa antes de enviar" };
  }

  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, organization_id, chatwoot_conversation_id")
    .eq("id", leadId)
    .single();

  if (error || !lead) {
    return { error: "Lead não encontrado (ou sem acesso)" };
  }
  if (!lead.chatwoot_conversation_id) {
    return {
      error:
        "Esse lead não tem conversa do Chatwoot vinculada — não dá pra responder",
    };
  }

  // 1. Envia mensagem
  const sent = await enviarMensagem({
    conversationId: lead.chatwoot_conversation_id,
    content: conteudo.trim(),
  });
  if ("error" in sent) {
    return { error: `Falha ao enviar pro Chatwoot: ${sent.error}` };
  }

  // 2. Aplica `agente-off` (Caio para de responder esse lead).
  // Falha aqui não bloqueia o fluxo — log only.
  const label = await addLabel({
    conversationId: lead.chatwoot_conversation_id,
    label: "agente-off",
  });
  if ("error" in label) {
    console.warn("[painel:responder]", "falha ao aplicar agente-off:", label.error);
  }

  // 3. Grava no Supabase com service role (bypassa RLS). Quando webhook do
  // Chatwoot chegar com a mesma mensagem, o unique constraint dedup.
  const admin = createAdminClient();
  await admin.from("mensagens").insert({
    organization_id: lead.organization_id,
    lead_id: lead.id,
    chatwoot_message_id: sent.id,
    chatwoot_conversation_id: lead.chatwoot_conversation_id,
    conteudo: sent.content,
    tipo: "texto",
    direcao: "saida",
    remetente_nome: "Você (painel)",
    privada: false,
  });

  revalidatePath(`/dashboard/leads/${leadId}`);
  return { ok: true };
}
