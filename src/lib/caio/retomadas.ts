/**
 * Worker de retomadas — leads com proximo_contato_em vencido.
 *
 * Quando lead pediu adiamento e marcou data, esse worker dispara a msg de
 * retomada (template configurado em organizations.mensagem_retomada) na hora
 * combinada. Depois religa o follow-up automatico — se o lead nao responder,
 * a cadencia normal volta a rodar.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { enviarMensagem } from "@/lib/caio/chatwoot-api";
import { gerarRespostaCaio } from "@/lib/caio/gerar-resposta";
import { logarEvento } from "@/lib/caio/eventos";

function aplicarTemplate(msg: string, nome: string | null): string {
  const primeiro = nome?.split(" ")[0] || "tudo bem";
  return msg.replace(/\{nome\}/g, primeiro);
}

export async function processarRetomadasPendentes(): Promise<{
  total: number;
  enviados: number;
  erros: number;
}> {
  const supabase = createAdminClient();

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, nome, organization_id, chatwoot_conversation_id, caio_ativo",
    )
    .eq("caio_ativo", true)
    .not("proximo_contato_em", "is", null)
    .lte("proximo_contato_em", new Date().toISOString())
    .limit(50);

  if (error || !leads) {
    console.error("[retomadas:cron]", "erro buscando:", error?.message);
    return { total: 0, enviados: 0, erros: 0 };
  }

  let enviadosCount = 0;
  let errosCount = 0;

  for (const lead of leads) {
    if (!lead.chatwoot_conversation_id) continue;

    // Le template da org
    const { data: org } = await supabase
      .from("organizations")
      .select("mensagem_retomada, mensagem_retomada_usa_ia")
      .eq("id", lead.organization_id)
      .single();

    const usaIa = org?.mensagem_retomada_usa_ia ?? true;
    const template =
      org?.mensagem_retomada ??
      "Oi {nome}! Conforme combinamos, voltando ao contato. Posso te ajudar?";

    let texto: string;
    if (usaIa) {
      const result = await gerarRespostaCaio({ leadId: lead.id });
      if ("error" in result) {
        texto = aplicarTemplate(template, lead.nome);
      } else {
        texto = result.resposta;
      }
    } else {
      texto = aplicarTemplate(template, lead.nome);
    }

    const sent = await enviarMensagem({
      conversationId: lead.chatwoot_conversation_id,
      content: texto,
    });
    if ("error" in sent) {
      console.error("[retomadas:cron]", lead.id, sent.error);
      errosCount++;
      continue;
    }

    // Limpa proximo_contato_em e religa cadencia de follow-up — se lead nao
    // responder a retomada, follow-up normal volta a rodar. status volta pra
    // em_conversa pra refletir que estamos tentando ativamente.
    const { data: orgFollowup } = await supabase
      .from("organizations")
      .select("followup_config")
      .eq("id", lead.organization_id)
      .single();
    const config = orgFollowup?.followup_config as
      | {
          regras?: {
            nivel: number;
            esperar_dias: number;
            esperar_horas: number;
            esperar_minutos: number;
            ativo: boolean;
          }[];
        }
      | null
      | undefined;
    const r1 = config?.regras?.find((r) => r.ativo && r.nivel === 1);
    let proximoFollowupEm: string | null = null;
    if (r1) {
      const d = new Date();
      d.setDate(d.getDate() + (r1.esperar_dias ?? 0));
      d.setHours(d.getHours() + (r1.esperar_horas ?? 0));
      d.setMinutes(d.getMinutes() + (r1.esperar_minutos ?? 0));
      proximoFollowupEm = d.toISOString();
    }

    await supabase
      .from("leads")
      .update({
        proximo_contato_em: null,
        status: "em_conversa",
        followup_ativo: true,
        numero_followup: 0,
        proximo_followup_em: proximoFollowupEm,
      })
      .eq("id", lead.id);

    await logarEvento({
      leadId: lead.id,
      organizationId: lead.organization_id,
      tipo: "lembrete_enviado",
      descricao: "Msg de retomada enviada (data combinada chegou)",
      autorNome: "Caio (automático)",
    });

    enviadosCount++;
    console.log("[retomadas:cron]", lead.id, "enviado");
  }

  return { total: leads.length, enviados: enviadosCount, erros: errosCount };
}
