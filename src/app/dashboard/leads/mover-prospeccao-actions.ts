"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logarEvento } from "@/lib/caio/eventos";

export type RelatorioMover = {
  movidos: number;
  pulados: { leadId: string; nome: string | null; motivo: string }[];
};

const STATUS_PERMITIDOS = new Set([
  // Inbound em qualquer fase pode virar prospecao manualmente
  "novo_lead",
  "em_conversa",
  "followup",
  "contatar_futuramente",
  "perdido",
  "fechou",
]);

/**
 * Move leads inbound (ou em qualquer status nao-outbound) pro fluxo de
 * prospeccao: muda origem='prospeccao', status='aguardando_primeiro_contato',
 * reseta contadores. NAO agenda primeira regra — o operador precisa clicar
 * "Disparar agora" na aba Prospeccao pra entrar na fila com intervalo.
 *
 * Mantem chatwoot_conversation_id existente — reutiliza a thread no WhatsApp
 * em vez de criar nova.
 *
 * Origem_inicial NUNCA muda — registra como o lead realmente entrou.
 */
export async function moverLeadsParaProspeccao(
  leadIds: string[],
): Promise<{ ok: true; relatorio: RelatorioMover } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  if (leadIds.length === 0) {
    return { ok: true, relatorio: { movidos: 0, pulados: [] } };
  }

  // Filtra pelo que o user enxerga via RLS
  const { data: leadsVisiveis, error } = await supabase
    .from("leads")
    .select("id, nome, status, organization_id, origem")
    .in("id", leadIds);
  if (error) return { error: error.message };
  if (!leadsVisiveis || leadsVisiveis.length === 0) {
    return { error: "Nenhum lead acessível" };
  }

  const admin = createAdminClient();
  const relatorio: RelatorioMover = { movidos: 0, pulados: [] };

  for (const lead of leadsVisiveis) {
    if (!STATUS_PERMITIDOS.has(lead.status)) {
      relatorio.pulados.push({
        leadId: lead.id,
        nome: lead.nome,
        motivo: `status "${lead.status}" não pode ir pra prospecção (já está no fluxo outbound ou em estado especial)`,
      });
      continue;
    }

    const { error: upErr } = await admin
      .from("leads")
      .update({
        origem: "prospeccao",
        status: "aguardando_primeiro_contato",
        caio_ativo: true,
        followup_ativo: true,
        numero_followup: 0,
        numero_reativacao: 0,
        numero_prospeccao: 0,
        proximo_followup_em: null,
        proximo_contato_em: null,
      })
      .eq("id", lead.id);
    if (upErr) {
      relatorio.pulados.push({
        leadId: lead.id,
        nome: lead.nome,
        motivo: `falha update: ${upErr.message}`,
      });
      continue;
    }

    await logarEvento({
      leadId: lead.id,
      organizationId: lead.organization_id,
      tipo: "status_mudou",
      descricao: `Lead movido pra prospecção (origem ${lead.origem ?? "?"} → prospeccao)`,
      autorNome: user.email ?? null,
    });

    relatorio.movidos++;
  }

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/prospeccao");
  for (const id of leadIds) {
    revalidatePath(`/dashboard/contatos/${id}`);
  }
  return { ok: true, relatorio };
}
