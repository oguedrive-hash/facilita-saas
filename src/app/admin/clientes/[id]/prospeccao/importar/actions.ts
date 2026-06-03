"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getJanela,
  proximoSlot,
} from "@/lib/caio/janela-prospeccao";
import {
  digitosTelefone,
  normalizarTelefoneBr,
} from "@/lib/caio/telefone";
import type { ProspeccaoConfig } from "../actions";

export type LeadImport = {
  nome: string;
  telefone: string;
  dados_extras: Record<string, string>;
};

export type RelatorioImportacao = {
  importados: number;
  reativados: number;
  pulados: number;
  invalidos: number;
  erros: { linha: number; motivo: string }[];
};

const STATUS_TERMINAIS = new Set(["perdido", "fechou"]);

// Normalizacao movida pra @/lib/caio/telefone — compartilhada com worker e
// validacao de disparo manual.

async function validarAdmin(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { error: "Apenas admin pode importar leads" };
  }
  return { ok: true };
}

/**
 * Importa lote de leads pra prospeccao.
 * - normaliza telefones
 * - checa duplicatas (telefone ja existe na org)
 * - cria leads com status='aguardando_primeiro_contato'
 * - agenda primeira regra de cadencia respeitando janela
 */
export async function importarLeadsProspeccao(
  organizationId: string,
  leads: LeadImport[],
): Promise<{ ok: true; relatorio: RelatorioImportacao } | { error: string }> {
  const auth = await validarAdmin();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();

  // Le cadencia + janela atual
  const { data: org } = await admin
    .from("organizations")
    .select("prospeccao_config, prospeccao_janela")
    .eq("id", organizationId)
    .single();
  const config = org?.prospeccao_config as ProspeccaoConfig | null;
  const janela = getJanela(org?.prospeccao_janela);
  const regrasAtivas = (config?.regras ?? []).filter((r) => r.ativo);
  const primeiraRegra = regrasAtivas.find((r) => r.nivel === 1);

  // Pega leads existentes da org com status pra decidir cada caso:
  //  - terminal (perdido/fechou) → reativa pra prospeccao
  //  - ativo (qualquer outro) → pula com warning
  const { data: existentes } = await admin
    .from("leads")
    .select("id, telefone, status, nome")
    .eq("organization_id", organizationId);
  const porDigitos = new Map<
    string,
    { id: string; status: string; nome: string | null }
  >();
  for (const l of existentes ?? []) {
    const k = digitosTelefone(l.telefone);
    if (k) porDigitos.set(k, { id: l.id, status: l.status, nome: l.nome });
  }

  const relatorio: RelatorioImportacao = {
    importados: 0,
    reativados: 0,
    pulados: 0,
    invalidos: 0,
    erros: [],
  };

  type NovoLead = {
    organization_id: string;
    nome: string;
    telefone: string;
    status: string;
    origem: "prospeccao";
    origem_inicial: "prospeccao";
    caio_ativo: boolean;
    followup_ativo: boolean;
    dados_extras: Record<string, string>;
    proximo_contato_em: string | null;
  };
  const aInserir: NovoLead[] = [];
  const aReativar: { id: string; proximoContatoEm: string | null }[] = [];
  // Set local pra evitar duplicidade entre linhas do mesmo CSV
  const telefonesDoLote = new Set<string>();

  function calcularProximoContatoEm(): string | null {
    if (!primeiraRegra) return null;
    const desejado = new Date();
    desejado.setDate(desejado.getDate() + primeiraRegra.esperar_dias);
    desejado.setHours(
      desejado.getHours() + primeiraRegra.esperar_horas,
      desejado.getMinutes() + primeiraRegra.esperar_minutos,
      0,
      0,
    );
    return proximoSlot(desejado, janela).toISOString();
  }

  for (let i = 0; i < leads.length; i++) {
    const l = leads[i];
    const linha = i + 2; // +2 pra contar header

    if (!l.nome?.trim()) {
      relatorio.invalidos++;
      relatorio.erros.push({ linha, motivo: "nome vazio" });
      continue;
    }
    const tel = normalizarTelefoneBr(l.telefone ?? "");
    if (!tel) {
      relatorio.invalidos++;
      relatorio.erros.push({ linha, motivo: "telefone inválido" });
      continue;
    }
    const telDigitos = digitosTelefone(tel);

    // Duplicata dentro do proprio CSV
    if (telefonesDoLote.has(telDigitos)) {
      relatorio.pulados++;
      relatorio.erros.push({
        linha,
        motivo: `telefone ${tel} aparece mais de uma vez no CSV`,
      });
      continue;
    }
    telefonesDoLote.add(telDigitos);

    const existente = porDigitos.get(telDigitos);
    if (existente) {
      if (STATUS_TERMINAIS.has(existente.status)) {
        // Reativa pra prospeccao
        aReativar.push({
          id: existente.id,
          proximoContatoEm: calcularProximoContatoEm(),
        });
        continue;
      }
      // Lead ativo em outro fluxo — pula com warning
      relatorio.pulados++;
      relatorio.erros.push({
        linha,
        motivo: `${existente.nome ?? "lead"} (${tel}) já está ativo no status "${existente.status}", importação ignorada`,
      });
      continue;
    }

    aInserir.push({
      organization_id: organizationId,
      nome: l.nome.trim(),
      telefone: tel,
      status: "aguardando_primeiro_contato",
      origem: "prospeccao",
      origem_inicial: "prospeccao",
      caio_ativo: true,
      followup_ativo: true,
      dados_extras: l.dados_extras ?? {},
      proximo_contato_em: calcularProximoContatoEm(),
    });
  }

  if (aInserir.length > 0) {
    const { error: insertErr } = await admin.from("leads").insert(aInserir);
    if (insertErr) {
      return { error: `Erro inserindo leads: ${insertErr.message}` };
    }
    relatorio.importados = aInserir.length;
  }

  // Reativa leads em status terminal pra cadencia outbound. Mantem
  // chatwoot_conversation_id existente — reusamos a thread antiga.
  for (const r of aReativar) {
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
        proximo_contato_em: r.proximoContatoEm,
      })
      .eq("id", r.id);
    if (upErr) {
      relatorio.erros.push({
        linha: 0,
        motivo: `falha ao reativar lead ${r.id}: ${upErr.message}`,
      });
      continue;
    }
    relatorio.reativados++;
  }

  revalidatePath(`/admin/clientes/${organizationId}/prospeccao`, "layout");
  revalidatePath(`/dashboard/prospeccao`);
  return { ok: true, relatorio };
}

/**
 * Cria 1 lead avulso via form manual.
 */
export async function criarLeadProspeccaoAvulso(
  organizationId: string,
  lead: LeadImport,
): Promise<{ ok: true } | { error: string }> {
  const result = await importarLeadsProspeccao(organizationId, [lead]);
  if ("error" in result) return result;
  if (result.relatorio.invalidos > 0) {
    return {
      error: result.relatorio.erros[0]?.motivo ?? "lead inválido",
    };
  }
  if (result.relatorio.pulados > 0) {
    return {
      error:
        result.relatorio.erros[0]?.motivo ?? "telefone já existe na base",
    };
  }
  return { ok: true };
}
