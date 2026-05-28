/**
 * Worker de lembretes de reuniao agendada.
 *
 * Para cada agendamento status="agendado", calcula pra cada regra de
 * lembrete_reuniao_config o instante de disparo (data_inicio +/- tempo).
 * Se ja passou e a regra ainda nao foi enviada (lembretes_enviados[]),
 * gera msg, envia via Chatwoot, e marca como enviado.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { enviarMensagem } from "@/lib/caio/chatwoot-api";
import { gerarRespostaCaio } from "@/lib/caio/gerar-resposta";
import { logarEvento } from "@/lib/caio/eventos";

type RegraLembrete = {
  nivel: number;
  quando: "antes" | "depois";
  tempo_dias: number;
  tempo_horas: number;
  tempo_minutos: number;
  mensagem: string;
  usa_ia: boolean;
  ativo: boolean;
};

type LembreteConfig = {
  regras: RegraLembrete[];
};

type AgendamentoProcess = {
  id: string;
  organization_id: string;
  lead_id: string;
  data_inicio: string;
  meet_link: string | null;
  lembretes_enviados: number[] | null;
  // Vem do join com lead
  lead: {
    id: string;
    nome: string | null;
    chatwoot_conversation_id: number | null;
  } | null;
};

function calcularInstanteDisparo(
  dataInicio: Date,
  regra: RegraLembrete,
): Date {
  const offsetMs =
    regra.tempo_dias * 24 * 3600 * 1000 +
    regra.tempo_horas * 3600 * 1000 +
    regra.tempo_minutos * 60 * 1000;
  const sinal = regra.quando === "antes" ? -1 : 1;
  return new Date(dataInicio.getTime() + sinal * offsetMs);
}

function aplicarTemplate(
  msg: string,
  nome: string | null,
  dataInicio: Date,
  meetLink: string | null,
): string {
  const primeiroNome = nome?.split(" ")[0] || "tudo bem";
  const hora = dataInicio.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const data = dataInicio.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  return msg
    .replace(/\{nome\}/g, primeiroNome)
    .replace(/\{hora\}/g, hora)
    .replace(/\{data\}/g, data)
    .replace(/\{meet_link\}/g, meetLink || "(link sendo gerado)");
}

export async function processarLembretesPendentes(): Promise<{
  total_agendamentos: number;
  enviados: number;
  erros: number;
}> {
  const supabase = createAdminClient();
  const agora = new Date();

  // Janela de busca: 7 dias antes ate o futuro proximo
  // (regra "antes" mais distante = 7 dias antes; "depois" mais distante = 1 dia depois)
  const inicioJanela = new Date(agora);
  inicioJanela.setDate(inicioJanela.getDate() - 1); // capturar "depois" recente
  const fimJanela = new Date(agora);
  fimJanela.setDate(fimJanela.getDate() + 7);

  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select(
      "id, organization_id, lead_id, data_inicio, meet_link, lembretes_enviados, lead:leads(id, nome, chatwoot_conversation_id)",
    )
    .eq("status", "agendado")
    .gte("data_inicio", inicioJanela.toISOString())
    .lte("data_inicio", fimJanela.toISOString())
    .limit(200);

  if (error || !agendamentos) {
    console.error("[lembrete:cron]", "erro buscando:", error?.message);
    return { total_agendamentos: 0, enviados: 0, erros: 0 };
  }

  let enviadosCount = 0;
  let errosCount = 0;

  for (const ag of agendamentos as unknown as AgendamentoProcess[]) {
    if (!ag.lead?.chatwoot_conversation_id) continue;

    // Le config da org
    const { data: org } = await supabase
      .from("organizations")
      .select("lembrete_reuniao_config")
      .eq("id", ag.organization_id)
      .single();
    const config = (org?.lembrete_reuniao_config ??
      null) as LembreteConfig | null;
    if (!config?.regras) continue;

    const dataInicio = new Date(ag.data_inicio);
    const enviadosNiveis = new Set(ag.lembretes_enviados ?? []);

    for (const regra of config.regras) {
      if (!regra.ativo) continue;
      if (enviadosNiveis.has(regra.nivel)) continue;

      const instante = calcularInstanteDisparo(dataInicio, regra);
      if (instante > agora) continue; // Ainda nao chegou a hora

      // Hora! Dispara o lembrete
      let texto: string;
      if (regra.usa_ia) {
        const result = await gerarRespostaCaio({ leadId: ag.lead_id });
        if ("error" in result) {
          texto = aplicarTemplate(
            regra.mensagem,
            ag.lead.nome,
            dataInicio,
            ag.meet_link,
          );
        } else {
          texto = result.resposta;
        }
      } else {
        texto = aplicarTemplate(
          regra.mensagem,
          ag.lead.nome,
          dataInicio,
          ag.meet_link,
        );
      }

      const sent = await enviarMensagem({
        conversationId: ag.lead.chatwoot_conversation_id,
        content: texto,
      });
      if ("error" in sent) {
        console.error(
          "[lembrete:cron]",
          ag.id,
          `nivel ${regra.nivel}`,
          sent.error,
        );
        errosCount++;
        continue;
      }

      // Marca nivel como enviado
      const novosEnviados = [...(ag.lembretes_enviados ?? []), regra.nivel];
      await supabase
        .from("agendamentos")
        .update({ lembretes_enviados: novosEnviados })
        .eq("id", ag.id);
      enviadosCount++;
      console.log("[lembrete:cron]", ag.id, `nivel ${regra.nivel} enviado`);

      await logarEvento({
        leadId: ag.lead_id,
        organizationId: ag.organization_id,
        tipo: "lembrete_enviado",
        descricao: `Lembrete de reunião nº${regra.nivel} enviado (${regra.quando})`,
        autorNome: "Caio (automático)",
        meta: { nivel: regra.nivel, agendamento_id: ag.id },
      });
    }
  }

  return {
    total_agendamentos: agendamentos.length,
    enviados: enviadosCount,
    erros: errosCount,
  };
}
