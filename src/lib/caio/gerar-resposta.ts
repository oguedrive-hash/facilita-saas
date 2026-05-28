import { createAdminClient } from "@/lib/supabase/admin";
import { chatCompletion, type ChatMessage } from "./openai";
import { CAIO_SYSTEM_PROMPT } from "./system-prompt";

/**
 * Gera uma resposta como Caio responderia, baseado no histórico do lead.
 *
 * Pega últimas N mensagens (não-shadow) do lead, monta o contexto no
 * formato OpenAI e chama o modelo configurado em OPENAI_MODEL.
 *
 * Retorna apenas o texto — quem chama decide se envia, salva como shadow,
 * mostra na UI, etc.
 */
export async function gerarRespostaCaio(opts: {
  leadId: string;
  limit?: number;
}): Promise<{ resposta: string } | { error: string }> {
  const limit = opts.limit ?? 30;
  const supabase = createAdminClient();

  const [{ data: lead }, { data: mensagens }] = await Promise.all([
    supabase
      .from("leads")
      .select("nome, organization_id")
      .eq("id", opts.leadId)
      .single(),
    supabase
      .from("mensagens")
      .select("conteudo, direcao, tipo, created_at")
      .eq("lead_id", opts.leadId)
      .eq("shadow", false) // ignora as próprias shadows do histórico
      .order("created_at", { ascending: true })
      .limit(limit),
  ]);

  if (!mensagens || mensagens.length === 0) {
    return { error: "Lead sem mensagens" };
  }

  // Busca prompt customizado da org (fallback pro hardcoded da Facilita)
  let promptBase = CAIO_SYSTEM_PROMPT;
  if (lead?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("prompt_system")
      .eq("id", lead.organization_id)
      .single();
    if (org?.prompt_system?.trim()) promptBase = org.prompt_system;
  }

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

  const systemContent = lead?.nome
    ? `${promptBase}\n\n[Contexto: o lead se chama ${lead.nome}. Use o nome quando fizer sentido.]`
    : promptBase;

  const result = await chatCompletion({
    messages: [{ role: "system", content: systemContent }, ...historico],
    temperature: 0.8,
    max_tokens: 400,
  });

  if ("error" in result) return result;
  return { resposta: result.content.trim() };
}
