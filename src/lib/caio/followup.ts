/**
 * Worker de follow-up — processa leads que estao com proximo_followup_em vencido.
 *
 * Fluxo por lead:
 * 1. Le followup_config da org
 * 2. Olha numero_followup atual e pega a regra do nivel seguinte
 * 3. Se regra.usa_ia, gera resposta via Caio com prompt especial de follow-up
 *    Senao, usa o template substituindo {nome}
 * 4. Envia via Chatwoot
 * 5. Atualiza numero_followup + ultimo_followup_em + proximo_followup_em
 * 6. Se nao houver proxima regra:
 *    - Marca status = "perdido"
 *    - Se reativacao.ativa, agenda proximo_followup_em pra esperar_dias depois
 *    - Senao, zera proximo_followup_em
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { enviarMensagem } from "@/lib/caio/chatwoot-api";
import { gerarRespostaCaio } from "@/lib/caio/gerar-resposta";
import { logarEvento } from "@/lib/caio/eventos";

type Regra = {
  nivel: number;
  esperar_dias: number;
  esperar_horas: number;
  esperar_minutos: number;
  mensagem: string;
  usa_ia: boolean;
  ativo: boolean;
};

type Reativacao = {
  ativa: boolean;
  esperar_dias: number;
  mensagem: string;
  usa_ia: boolean;
};

type FollowupConfig = {
  regras: Regra[];
  reativacao: Reativacao;
};

type LeadProcess = {
  id: string;
  nome: string | null;
  telefone: string;
  status: string;
  organization_id: string;
  numero_followup: number | null;
  chatwoot_conversation_id: number | null;
  caio_ativo: boolean | null;
  followup_ativo: boolean | null;
};

/**
 * Substitui placeholders em uma mensagem template.
 * Hoje so suporta {nome}; futuramente pode crescer (telefone, empresa, etc).
 */
function aplicarTemplate(msg: string, lead: LeadProcess): string {
  const nome = lead.nome?.split(" ")[0] || "tudo bem";
  return msg.replace(/\{nome\}/g, nome);
}

function calcularProximoEm(
  dias: number,
  horas: number,
  minutos: number,
): Date {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(d.getHours() + horas);
  d.setMinutes(d.getMinutes() + minutos);
  return d;
}

export async function processarFollowupLead(
  lead: LeadProcess,
): Promise<
  | { ok: true; acao: "followup" | "reativacao" | "desistencia" }
  | { error: string }
> {
  const supabase = createAdminClient();

  if (!lead.chatwoot_conversation_id) {
    return { error: "lead sem chatwoot_conversation_id" };
  }
  if (!lead.caio_ativo || lead.followup_ativo === false) {
    // Caio desligado ou follow-up pausado pelo user — zera o agendamento
    await supabase
      .from("leads")
      .update({ proximo_followup_em: null })
      .eq("id", lead.id);
    return { ok: true, acao: "desistencia" };
  }

  // Le config da org
  const { data: org } = await supabase
    .from("organizations")
    .select("followup_config, followup_mudar_status_a_partir")
    .eq("id", lead.organization_id)
    .single();

  const config = (org?.followup_config ?? null) as FollowupConfig | null;
  const mudarStatusAPartir =
    (org?.followup_mudar_status_a_partir as number | null) ?? 1;
  if (!config?.regras) {
    return { error: "org sem followup_config" };
  }

  const regrasAtivas = config.regras.filter((r) => r.ativo);
  const proximoNivel = (lead.numero_followup ?? 0) + 1;
  const regra = regrasAtivas.find((r) => r.nivel === proximoNivel);

  // Sem regra pra esse nivel → desistir ou tentar reativacao
  if (!regra) {
    return await processarFimRegras(lead, config);
  }

  // Gera mensagem (IA ou template)
  let texto: string;
  if (regra.usa_ia) {
    const result = await gerarRespostaCaio({ leadId: lead.id });
    if ("error" in result) {
      console.error("[followup:ia]", lead.id, result.error);
      // Fallback pro template do user
      texto = aplicarTemplate(regra.mensagem, lead);
    } else {
      texto = result.resposta;
    }
  } else {
    texto = aplicarTemplate(regra.mensagem, lead);
  }

  // Envia pelo Chatwoot
  const sent = await enviarMensagem({
    conversationId: lead.chatwoot_conversation_id,
    content: texto,
  });
  if ("error" in sent) {
    return { error: `envio falhou: ${sent.error}` };
  }

  // Atualiza tracking — proximo agendamento ou termino do ciclo
  const proximaRegra = regrasAtivas.find((r) => r.nivel === proximoNivel + 1);
  const proximoEm = proximaRegra
    ? calcularProximoEm(
        proximaRegra.esperar_dias,
        proximaRegra.esperar_horas,
        proximaRegra.esperar_minutos ?? 0,
      )
    : null;

  const update: Record<string, unknown> = {
    numero_followup: proximoNivel,
    ultimo_followup_em: new Date().toISOString(),
    proximo_followup_em: proximoEm?.toISOString() ?? null,
  };
  // So muda pra status "followup" se atingiu o gatilho configurado da org.
  // Antes disso, mantem o status atual (em_conversa, novo_lead, etc).
  if (
    proximoNivel >= mudarStatusAPartir &&
    (lead.status === "novo_lead" || lead.status === "em_conversa")
  ) {
    update.status = "followup";
  }

  // Se essa foi a ultima regra ativa, encerra ciclo (desistencia ou reativacao)
  if (!proximaRegra) {
    if (config.reativacao?.ativa) {
      const reativacaoEm = new Date();
      reativacaoEm.setDate(
        reativacaoEm.getDate() + (config.reativacao.esperar_dias ?? 30),
      );
      update.proximo_followup_em = reativacaoEm.toISOString();
      // Mantem status — ainda nao "perdeu" ate a reativacao falhar
    } else {
      update.status = "perdido";
      update.proximo_followup_em = null;
    }
  }

  await supabase.from("leads").update(update).eq("id", lead.id);

  await logarEvento({
    leadId: lead.id,
    organizationId: lead.organization_id,
    tipo: "followup_enviado",
    descricao: `Follow-up nº${proximoNivel} enviado${regra.usa_ia ? " (gerado por IA)" : ""}`,
    autorNome: "Caio (automático)",
    meta: { nivel: proximoNivel, usa_ia: regra.usa_ia },
  });

  return { ok: true, acao: "followup" };
}

/**
 * Chamado quando esgotaram as regras do followup principal.
 * Se reativacao tiver ativa, executa a reativacao agora.
 * Senao, marca como perdido.
 */
async function processarFimRegras(
  lead: LeadProcess,
  config: FollowupConfig,
): Promise<{ ok: true; acao: "reativacao" | "desistencia" }> {
  const supabase = createAdminClient();
  const reat = config.reativacao;

  if (!reat?.ativa || !lead.chatwoot_conversation_id) {
    await supabase
      .from("leads")
      .update({ status: "perdido", proximo_followup_em: null })
      .eq("id", lead.id);
    return { ok: true, acao: "desistencia" };
  }

  // Envia reativacao
  let texto: string;
  if (reat.usa_ia) {
    const result = await gerarRespostaCaio({ leadId: lead.id });
    if ("error" in result) {
      texto = aplicarTemplate(reat.mensagem, lead);
    } else {
      texto = result.resposta;
    }
  } else {
    texto = aplicarTemplate(reat.mensagem, lead);
  }

  await enviarMensagem({
    conversationId: lead.chatwoot_conversation_id,
    content: texto,
  });

  // Apos reativacao, marca como perdido e nao tenta de novo
  await supabase
    .from("leads")
    .update({
      ultimo_followup_em: new Date().toISOString(),
      proximo_followup_em: null,
      status: "perdido",
    })
    .eq("id", lead.id);

  await logarEvento({
    leadId: lead.id,
    organizationId: lead.organization_id,
    tipo: "reativacao_enviada",
    descricao: "Mensagem de reativação enviada — lead marcado como perdido",
    autorNome: "Caio (automático)",
  });

  return { ok: true, acao: "reativacao" };
}

/**
 * Busca todos os leads com followup pendente e processa.
 * Chamado pelo endpoint /api/cron/followup que e disparado pelo crontab.
 */
export async function processarFollowupsPendentes(): Promise<{
  total: number;
  ok: number;
  erros: number;
}> {
  const supabase = createAdminClient();

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, nome, telefone, status, organization_id, numero_followup, chatwoot_conversation_id, caio_ativo, followup_ativo",
    )
    .eq("caio_ativo", true)
    .eq("followup_ativo", true)
    .not("proximo_followup_em", "is", null)
    .lte("proximo_followup_em", new Date().toISOString())
    .limit(50); // safety cap por execucao

  if (error || !leads) {
    console.error("[followup:cron]", "erro buscando leads:", error?.message);
    return { total: 0, ok: 0, erros: 0 };
  }

  let okCount = 0;
  let erroCount = 0;
  for (const lead of leads) {
    try {
      const result = await processarFollowupLead(lead);
      if ("error" in result) {
        console.error("[followup:cron]", lead.id, result.error);
        erroCount++;
      } else {
        console.log("[followup:cron]", lead.id, result.acao);
        okCount++;
      }
    } catch (err) {
      console.error("[followup:cron]", lead.id, err);
      erroCount++;
    }
  }

  return { total: leads.length, ok: okCount, erros: erroCount };
}
