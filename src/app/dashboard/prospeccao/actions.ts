"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processarProspeccaoLead } from "@/lib/caio/prospeccao";
import { digitosTelefone } from "@/lib/caio/telefone";

export type RelatorioDisparo = {
  enviados: number;
  agendados: number;
  falhas: { leadId: string; nome: string | null; motivo: string }[];
};

/**
 * Dispara a primeira mensagem da cadência pros leads selecionados, mas
 * RESPEITANDO janela horária + rate limit (protecao anti-ban WhatsApp).
 *
 * Pensado pro botão "Disparar agora" em /dashboard/prospeccao. Se você
 * tiver 20 leads selecionados e o rate limit for 10/h, os 10 primeiros
 * disparam imediatamente e os 10 restantes ficam agendados pra +1h.
 * Se estiver fora da janela (ex: 22h, janela é 9-18h), todos são
 * agendados pra próxima janela.
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

  // Le os leads usando RLS — se o user nao tem acesso a algum, ele simplesmente
  // nao volta na query.
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
  const orgsAfetadas = new Set<string>();

  // Antes de disparar, checa se algum dos selecionados tem telefone que ja
  // existe em OUTRO lead da mesma org. Se sim, o Chatwoot vai roteor a msg
  // pra conversa do outro lead (mesmo contato/inbox) — bug grave que
  // queremos evitar antes que aconteca.
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

  // Processa sequencial pra evitar disputar rate de envio.
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
        orgsAfetadas.add(lead.organization_id);
      } else if (result.acao === "reagendou") {
        relatorio.agendados++;
      } else {
        relatorio.falhas.push({
          leadId: lead.id,
          nome: lead.nome,
          motivo: `worker devolveu '${result.acao}' (esperado 'enviou' ou 'reagendou')`,
        });
      }
    } catch (err) {
      relatorio.falhas.push({
        leadId: lead.id,
        nome: lead.nome,
        motivo: err instanceof Error ? err.message : String(err),
      });
    }
  }

  revalidatePath("/dashboard/prospeccao");
  return { ok: true, relatorio };
}
