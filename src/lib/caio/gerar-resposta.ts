import { createAdminClient } from "@/lib/supabase/admin";
import { chatCompletion, type ChatMessage } from "./openai";

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
      .select("nome, organization_id, origem, dados_extras")
      .eq("id", opts.leadId)
      .single(),
    supabase
      .from("mensagens")
      .select("conteudo, direcao, tipo, created_at")
      .eq("lead_id", opts.leadId)
      .eq("shadow", false) // ignora as próprias shadows do histórico
      // Pega as N MAIS RECENTES (desc + limit), depois reverte pra cronológica
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (!mensagens || mensagens.length === 0) {
    return { error: "Lead sem mensagens" };
  }
  // Inverte pra ordem cronológica (mais antiga primeiro) — é como o OpenAI espera
  mensagens.reverse();

  // Prompt vem exclusivamente da organization — sem fallback hardcoded.
  if (!lead?.organization_id) {
    return { error: "Lead sem organization vinculada" };
  }
  const { data: org } = await supabase
    .from("organizations")
    .select("prompt_system, prompt_system_prospeccao, base_conhecimento")
    .eq("id", lead.organization_id)
    .single();
  // Comportamento (como Caio age) varia por canal. Base de conhecimento
  // (o que Caio sabe sobre a empresa) é compartilhada.
  //   - prospeccao + comportamento de prospeccao preenchido → usa ele
  //   - resto → usa o inbound padrao
  // Se prospeccao sem comportamento proprio, cai no inbound — pelo menos
  // tem instrucao base, e o bloco de contexto que adicionamos abaixo
  // (`extras`) reforca que o canal e prospeccao.
  const ehProspeccao = lead?.origem === "prospeccao";
  const comportamentoProsp = org?.prompt_system_prospeccao?.trim();
  const comportamentoInbound = org?.prompt_system?.trim();
  const comportamento =
    ehProspeccao && comportamentoProsp
      ? comportamentoProsp
      : comportamentoInbound;
  if (!comportamento) {
    return {
      error:
        "Organization sem prompt configurado — configure em Admin → Caio",
    };
  }
  const baseConhecimento = org?.base_conhecimento?.trim();
  // Junta comportamento + base (com separador legivel). Base entra como
  // bloco rotulado pra ficar claro pro modelo onde estao os fatos.
  const promptBase = baseConhecimento
    ? `${comportamento}\n\n[Base de Conhecimento da empresa — use SOMENTE essas informações como fonte de verdade, não invente outras]\n${baseConhecimento}`
    : comportamento;

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

  // Anexos contextuais ao prompt
  const extras: string[] = [];
  if (lead?.nome) {
    extras.push(
      `O lead se chama ${lead.nome}. Use o nome quando fizer sentido.`,
    );
  }
  if (lead?.origem === "prospeccao") {
    extras.push(
      `Esse lead veio de prospecção ativa — VOCÊ iniciou o contato, ele NÃO entrou em contato com a gente primeiro. NÃO diga "obrigado por entrar em contato" ou frases similares. Trate como continuação natural do contato que você começou.`,
    );
    const dadosExtras = lead.dados_extras as Record<string, string> | null;
    if (dadosExtras && Object.keys(dadosExtras).length > 0) {
      const linhasExtras = Object.entries(dadosExtras)
        .map(([k, v]) => `  - ${k}: ${v}`)
        .join("\n");
      extras.push(
        `Dados conhecidos sobre o lead (use quando relevante):\n${linhasExtras}`,
      );
    }
  }
  const systemContent =
    extras.length > 0
      ? `${promptBase}\n\n[Contexto:\n${extras.join("\n\n")}]`
      : promptBase;

  const result = await chatCompletion({
    messages: [{ role: "system", content: systemContent }, ...historico],
    temperature: 0.8,
    max_tokens: 400,
  });

  if ("error" in result) return result;
  return { resposta: result.content.trim() };
}
