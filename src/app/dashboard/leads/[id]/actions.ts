"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addLabel,
  enviarMensagem,
  setLabels,
  getLabels,
  toggleConversationStatus,
} from "@/lib/caio/chatwoot-api";
import { chatCompletion, type ChatMessage } from "@/lib/caio/openai";
import { CAIO_SYSTEM_PROMPT, RESUMO_PROMPT } from "@/lib/caio/system-prompt";
import type { StatusLead } from "@/lib/status-config";

const AGENTE_OFF = "agente-off";

// Status que sinalizam que o lead "saiu" do funil — ao chegar nesses
// status, desligamos o Caio e resolvemos a conversa no Chatwoot.
const STATUS_TERMINAIS: StatusLead[] = ["fechou", "perdido"];

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

/**
 * Muda o status do lead manualmente pelo painel.
 *
 * Se o novo status for terminal (`fechou` ou `perdido`):
 *   - Aplica etiqueta `agente-off` (Caio para)
 *   - Resolve a conversa no Chatwoot
 *   - Atualiza `caio_ativo = false` no Supabase
 *
 * Se sair de um status terminal pra um ativo (ex: voltar pra `em_conversa`):
 *   - Reabre a conversa no Chatwoot
 *   (a etiqueta agente-off NÃO é removida automaticamente — usa o toggle pra isso)
 */
export async function mudarStatusLead(formData: FormData): Promise<
  { ok: true } | { error: string }
> {
  const leadId = formData.get("leadId");
  const novoStatus = formData.get("status");
  const razao = formData.get("razao");

  if (typeof leadId !== "string" || !leadId) {
    return { error: "leadId ausente" };
  }
  if (typeof novoStatus !== "string" || !novoStatus) {
    return { error: "status ausente" };
  }

  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, status, chatwoot_conversation_id")
    .eq("id", leadId)
    .single();

  if (error || !lead) return { error: "Lead não encontrado" };

  const statusAntigo = lead.status as StatusLead;
  const statusNovo = novoStatus as StatusLead;
  const ehTerminal = STATUS_TERMINAIS.includes(statusNovo);
  const eraTerminal = STATUS_TERMINAIS.includes(statusAntigo);

  // Atualiza status no Supabase
  const admin = createAdminClient();
  const update: Record<string, unknown> = { status: statusNovo };
  if (typeof razao === "string" && razao.trim()) {
    update.razao = razao.trim();
  }
  if (ehTerminal) update.caio_ativo = false;

  const { error: updateErr } = await admin
    .from("leads")
    .update(update)
    .eq("id", leadId);

  if (updateErr) {
    return { error: `Erro ao atualizar: ${updateErr.message}` };
  }

  // Sincroniza Chatwoot — só se tiver conversa vinculada
  if (lead.chatwoot_conversation_id) {
    if (ehTerminal) {
      await addLabel({
        conversationId: lead.chatwoot_conversation_id,
        label: AGENTE_OFF,
      });
      await toggleConversationStatus({
        conversationId: lead.chatwoot_conversation_id,
        status: "resolved",
      });
    } else if (eraTerminal) {
      // saiu de terminal → reabre a conversa
      await toggleConversationStatus({
        conversationId: lead.chatwoot_conversation_id,
        status: "open",
      });
    }
  }

  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard/leads");
  return { ok: true };
}

/**
 * Deleta um lead permanentemente.
 * Cascade remove mensagens e agendamentos vinculados.
 * NÃO mexe no Chatwoot — se o lead mandar nova mensagem, vai ser recriado.
 */
export async function deletarLead(formData: FormData): Promise<
  { ok: true } | { error: string }
> {
  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || !leadId) {
    return { error: "leadId ausente" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/leads");
  return { ok: true };
}

/**
 * Gera resumo IA da conversa do lead via OpenAI.
 * Pega as últimas 40 mensagens, manda pra OpenAI com o RESUMO_PROMPT,
 * salva o resultado em leads.resumo_ia + leads.resumo_gerado_em.
 */
export async function gerarResumoIA(formData: FormData): Promise<
  { ok: true; resumo: string } | { error: string }
> {
  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || !leadId) {
    return { error: "leadId ausente" };
  }

  const supabase = await createClient();

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("nome, telefone")
    .eq("id", leadId)
    .single();
  if (leadErr || !lead) return { error: "Lead não encontrado" };

  const { data: mensagens, error: msgErr } = await supabase
    .from("mensagens")
    .select("conteudo, direcao, tipo, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true })
    .limit(40);
  if (msgErr) return { error: msgErr.message };
  if (!mensagens || mensagens.length === 0) {
    return { error: "Esse lead ainda não tem mensagens pra resumir" };
  }

  // Formata conversa pra OpenAI
  const transcript = mensagens
    .map((m) => {
      const quem = m.direcao === "entrada" ? lead.nome ?? "Lead" : "Caio";
      const conteudo =
        m.tipo !== "texto"
          ? `[${m.tipo}${m.conteudo ? `: ${m.conteudo}` : ""}]`
          : m.conteudo ?? "";
      return `${quem}: ${conteudo}`;
    })
    .join("\n");

  const result = await chatCompletion({
    messages: [
      { role: "system", content: RESUMO_PROMPT },
      {
        role: "user",
        content: `Lead: ${lead.nome ?? "(sem nome)"} (${lead.telefone})\n\nConversa:\n${transcript}\n\nGere o resumo:`,
      },
    ],
    temperature: 0.3,
    max_tokens: 400,
  });

  if ("error" in result) {
    return { error: `Falha na OpenAI: ${result.error}` };
  }

  // Salva no banco
  const admin = createAdminClient();
  await admin
    .from("leads")
    .update({
      resumo_ia: result.content,
      resumo_gerado_em: new Date().toISOString(),
    })
    .eq("id", leadId);

  revalidatePath(`/dashboard/leads/${leadId}`);
  return { ok: true, resumo: result.content };
}

/**
 * Gera uma sugestão de resposta do Caio com base no histórico da conversa.
 * NÃO envia — só devolve o texto pra UI preencher o textarea.
 */
export async function gerarSugestaoResposta(formData: FormData): Promise<
  { ok: true; sugestao: string } | { error: string }
> {
  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || !leadId) {
    return { error: "leadId ausente" };
  }

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("nome")
    .eq("id", leadId)
    .single();

  const { data: mensagens } = await supabase
    .from("mensagens")
    .select("conteudo, direcao, tipo, remetente_nome, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true })
    .limit(30);

  if (!mensagens || mensagens.length === 0) {
    return { error: "Lead ainda não tem mensagens — não dá pra sugerir resposta" };
  }

  // Monta histórico no formato OpenAI:
  // - direcao=entrada (lead falando) → role: "user"
  // - direcao=saida (Caio ou painel) → role: "assistant"
  // Áudio/imagem/arquivo sem texto vira marcador "[tipo]".
  const historico: ChatMessage[] = mensagens.map((m) => {
    let content: string;
    if (m.tipo !== "texto") {
      content = m.conteudo
        ? `[${m.tipo}: ${m.conteudo}]`
        : `[${m.tipo} sem transcrição]`;
    } else {
      content = m.conteudo ?? "";
    }
    return {
      role: m.direcao === "entrada" ? "user" : "assistant",
      content,
    };
  });

  // Sistema: prompt do Caio + dica do nome do lead se souber
  const systemContent = lead?.nome
    ? `${CAIO_SYSTEM_PROMPT}\n\n[Contexto: o lead se chama ${lead.nome}. Use o nome quando fizer sentido.]`
    : CAIO_SYSTEM_PROMPT;

  const result = await chatCompletion({
    messages: [{ role: "system", content: systemContent }, ...historico],
    temperature: 0.8,
    max_tokens: 400,
  });

  if ("error" in result) {
    return { error: `Falha na OpenAI: ${result.error}` };
  }

  return { ok: true, sugestao: result.content.trim() };
}

/**
 * Salva notas internas (observações livres do agente humano) no lead.
 */
export async function salvarNotas(formData: FormData): Promise<
  { ok: true } | { error: string }
> {
  const leadId = formData.get("leadId");
  const notas = formData.get("notas");

  if (typeof leadId !== "string" || !leadId) {
    return { error: "leadId ausente" };
  }
  if (typeof notas !== "string") {
    return { error: "notas inválidas" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ notas: notas.trim() || null })
    .eq("id", leadId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/leads/${leadId}`);
  return { ok: true };
}
