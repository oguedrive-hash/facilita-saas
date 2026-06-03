"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processarProspeccaoLead } from "@/lib/caio/prospeccao";
import { getJanela } from "@/lib/caio/janela-prospeccao";
import { digitosTelefone } from "@/lib/caio/telefone";

export type RelatorioDisparo = {
  enviados: number;
  agendados: number;
  falhas: { leadId: string; nome: string | null; motivo: string }[];
};

/**
 * Dispara a primeira mensagem da cadência pros leads selecionados,
 * espacando os disparos com o `intervalo_minutos` configurado.
 *
 * Pensado pro botão "Disparar agora" em /dashboard/prospeccao. O 1º lead
 * dispara imediatamente; os seguintes ficam agendados no `proximo_contato_em`
 * com `intervalo_minutos` entre cada um — o cron de prospecção pega e
 * dispara cada um quando chega a hora. Isso evita rajada de msgs que o
 * WhatsApp marcaria como spam.
 *
 * Por org: usa um intervalo separado por organização. Se o lote tem leads
 * de orgs diferentes (uso multi-tenant), cada org tem sua propria fila.
 */
export async function dispararPrimeirasMensagensEmLote(
  leadIds: string[],
): Promise<{ ok: true; relatorio: RelatorioDisparo } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  if (leadIds.length === 0) {
    return { ok: true, relatorio: { enviados: 0, agendados: 0, falhas: [] } };
  }

  const { data: leadsVisiveis, error } = await supabase
    .from("leads")
    .select(
      "id, nome, telefone, status, organization_id, numero_prospeccao, dados_extras, chatwoot_conversation_id, caio_ativo, origem",
    )
    .in("id", leadIds)
    .eq("origem", "prospeccao");

  if (error) return { error: error.message };
  if (!leadsVisiveis || leadsVisiveis.length === 0) {
    return { error: "Nenhum lead acessível" };
  }

  const relatorio: RelatorioDisparo = { enviados: 0, agendados: 0, falhas: [] };

  // Detecta conflito de telefone duplicado em outro lead da mesma org
  // (Chatwoot rotearia msg pra conversa errada).
  const admin = createAdminClient();
  const orgIds = Array.from(
    new Set(leadsVisiveis.map((l) => l.organization_id)),
  );
  const { data: todosDaOrg } = await admin
    .from("leads")
    .select("id, telefone, nome, origem")
    .in("organization_id", orgIds);
  const conflitosPorLead = new Map<
    string,
    { nome: string | null; origem: string | null }
  >();
  if (todosDaOrg) {
    const porDigitos = new Map<
      string,
      { id: string; nome: string | null; origem: string | null }[]
    >();
    for (const l of todosDaOrg) {
      const k = digitosTelefone(l.telefone);
      if (!k) continue;
      const arr = porDigitos.get(k) ?? [];
      arr.push({ id: l.id, nome: l.nome, origem: l.origem });
      porDigitos.set(k, arr);
    }
    for (const lead of leadsVisiveis) {
      const k = digitosTelefone(lead.telefone);
      const matches = (porDigitos.get(k) ?? []).filter((m) => m.id !== lead.id);
      if (matches.length > 0) {
        conflitosPorLead.set(lead.id, matches[0]);
      }
    }
  }

  // Le intervalo configurado por org (cache local)
  const intervaloPorOrg = new Map<string, number>();
  for (const orgId of orgIds) {
    const { data: org } = await admin
      .from("organizations")
      .select("prospeccao_janela")
      .eq("id", orgId)
      .single();
    const janela = getJanela(org?.prospeccao_janela);
    intervaloPorOrg.set(orgId, janela.intervalo_minutos);
  }

  // Conta agendamentos por org (pra calcular o offset de cada lead na fila)
  const agendadosPorOrg = new Map<string, number>();

  const agora = Date.now();
  let disparouPrimeiroDaOrg = new Set<string>();

  for (const lead of leadsVisiveis) {
    const conflito = conflitosPorLead.get(lead.id);
    if (conflito) {
      relatorio.falhas.push({
        leadId: lead.id,
        nome: lead.nome,
        motivo: `telefone ${lead.telefone} já existe em outro lead (${conflito.nome ?? "?"} / origem ${conflito.origem ?? "?"}). Não disparei pra evitar conflito de conversa no WhatsApp. Remova o lead duplicado primeiro.`,
      });
      continue;
    }

    const orgId = lead.organization_id;
    const intervalo = intervaloPorOrg.get(orgId) ?? 2;

    // 1º lead de cada org → dispara imediato.
    // Demais leads da mesma org → agenda com offset.
    if (!disparouPrimeiroDaOrg.has(orgId)) {
      disparouPrimeiroDaOrg.add(orgId);
      try {
        const result = await processarProspeccaoLead({
          id: lead.id,
          nome: lead.nome,
          telefone: lead.telefone,
          status: lead.status,
          organization_id: lead.organization_id,
          numero_prospeccao: lead.numero_prospeccao,
          dados_extras: lead.dados_extras as Record<string, string> | null,
          chatwoot_conversation_id: lead.chatwoot_conversation_id,
          caio_ativo: lead.caio_ativo,
        });
        if ("error" in result) {
          relatorio.falhas.push({
            leadId: lead.id,
            nome: lead.nome,
            motivo: result.error,
          });
        } else if (result.acao === "enviou") {
          relatorio.enviados++;
        } else {
          relatorio.falhas.push({
            leadId: lead.id,
            nome: lead.nome,
            motivo: `worker devolveu '${result.acao}' (esperado 'enviou')`,
          });
        }
      } catch (err) {
        relatorio.falhas.push({
          leadId: lead.id,
          nome: lead.nome,
          motivo: err instanceof Error ? err.message : String(err),
        });
      }
      continue;
    }

    // Já tem 1+ desta org agendado/enviado — esse vai na fila
    const offsetIdx = (agendadosPorOrg.get(orgId) ?? 0) + 1;
    agendadosPorOrg.set(orgId, offsetIdx);
    const proximo = new Date(agora + offsetIdx * intervalo * 60 * 1000);
    const { error: upErr } = await admin
      .from("leads")
      .update({ proximo_contato_em: proximo.toISOString() })
      .eq("id", lead.id);
    if (upErr) {
      relatorio.falhas.push({
        leadId: lead.id,
        nome: lead.nome,
        motivo: `erro ao agendar: ${upErr.message}`,
      });
      continue;
    }
    relatorio.agendados++;
  }

  revalidatePath("/dashboard/prospeccao");
  return { ok: true, relatorio };
}
