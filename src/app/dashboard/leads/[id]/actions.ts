"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addLabel,
  enviarMensagem,
  setLabels,
  getLabels,
} from "@/lib/caio/chatwoot-api";

const AGENTE_OFF = "agente-off";

/**
 * Envia uma mensagem pelo painel respondendo um lead.
 *
 * Aceita `desligar_caio` como flag opcional no FormData. Se for "true",
 * aplica a etiqueta `agente-off` (Caio para de responder esse lead).
 */
export async function responderLead(formData: FormData): Promise<
  { ok: true } | { error: string }
> {
  const leadId = formData.get("leadId");
  const conteudo = formData.get("conteudo");
  const desligarCaio = formData.get("desligar_caio") === "true";

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

  const sent = await enviarMensagem({
    conversationId: lead.chatwoot_conversation_id,
    content: conteudo.trim(),
  });
  if ("error" in sent) {
    return { error: `Falha ao enviar pro Chatwoot: ${sent.error}` };
  }

  if (desligarCaio) {
    const label = await addLabel({
      conversationId: lead.chatwoot_conversation_id,
      label: AGENTE_OFF,
    });
    if ("error" in label) {
      console.warn(
        "[painel:responder]",
        "falha ao aplicar agente-off:",
        label.error,
      );
    } else {
      const admin = createAdminClient();
      await admin
        .from("leads")
        .update({ caio_ativo: false })
        .eq("id", leadId);
    }
  }

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

/**
 * Liga/desliga o Caio pra um lead específico (adiciona ou remove a
 * etiqueta `agente-off` na conversa do Chatwoot).
 */
export async function toggleCaio(formData: FormData): Promise<
  { ok: true; ativo: boolean } | { error: string }
> {
  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || !leadId) {
    return { error: "leadId ausente" };
  }

  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .select("chatwoot_conversation_id")
    .eq("id", leadId)
    .single();

  if (error || !lead) return { error: "Lead não encontrado" };
  if (!lead.chatwoot_conversation_id) {
    return { error: "Lead sem conversa do Chatwoot vinculada" };
  }

  const labels = await getLabels({
    conversationId: lead.chatwoot_conversation_id,
  });
  const temAgenteOff = labels.includes(AGENTE_OFF);

  const novasLabels = temAgenteOff
    ? labels.filter((l) => l !== AGENTE_OFF)
    : [...labels, AGENTE_OFF];

  const result = await setLabels({
    conversationId: lead.chatwoot_conversation_id,
    labels: novasLabels,
  });
  if ("error" in result) {
    return { error: `Chatwoot recusou: ${result.error}` };
  }

  // Espelha no Supabase pra listagem ficar consistente sem precisar
  // bater na API do Chatwoot toda vez.
  const admin = createAdminClient();
  await admin
    .from("leads")
    .update({ caio_ativo: temAgenteOff })
    .eq("id", leadId);

  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard/leads");
  // ativo = caio respondendo = NÃO tem agente-off (depois da troca)
  return { ok: true, ativo: temAgenteOff };
}
