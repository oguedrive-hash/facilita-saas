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

  const { data: lead } = await supabase
    .from("leads")
    .select("nome")
    .eq("id", opts.leadId)
    .single();

  const { data: mensagens } = await supabase
    .from("mensagens")
    .select("conteudo, direcao, tipo, created_at")
    .eq("lead_id", opts.leadId)
    .eq("shadow", false) // ignora as próprias shadows do histórico
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!mensagens || mensagens.length === 0) {
    return { error: "Lead sem mensagens" };
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
    ? `${CAIO_SYSTEM_PROMPT}\n\n[Contexto: o lead se chama ${lead.nome}. Use o nome quando fizer sentido.]`
    : CAIO_SYSTEM_PROMPT;

  const result = await chatCompletion({
    messages: [{ role: "system", content: systemContent }, ...historico],
    temperature: 0.8,
    max_tokens: 400,
  });

  if ("error" in result) return result;
  return { resposta: result.content.trim() };
}
