"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  digitosTelefone,
  normalizarTelefoneBr,
} from "@/lib/caio/telefone";

export type LeadImport = {
  nome: string;
  telefone: string;
  dados_extras: Record<string, string>;
};

export type ComoOrigem = "inbound" | "prospeccao";

export type RelatorioImportacao = {
  importados: number;
  reativados: number;
  pulados: number;
  invalidos: number;
  erros: { linha: number; motivo: string }[];
};

const STATUS_TERMINAIS = new Set(["perdido", "fechou"]);

/**
 * Importa lote de contatos pra base. O operador escolhe:
 *  - "inbound"   → leads ficam com origem=inbound, status=novo_lead, sem
 *                  cadência ativa (esperam o cliente mandar msg)
 *  - "prospeccao"→ leads ficam com origem=prospeccao, status=aguardando_primeiro_contato,
 *                  SEM proximo_contato_em (operador dispara manualmente via
 *                  "Disparar agora" pra entrar na fila com intervalo)
 *
 * Duplicatas (telefone normalizado) sao tratadas igual em ambos os modos:
 *  - lead existente em status terminal (perdido/fechou) → reativa pra origem escolhida
 *  - lead existente em status ativo → pula com aviso
 */
export async function importarContatosLote(
  leads: LeadImport[],
  como: ComoOrigem,
): Promise<{ ok: true; relatorio: RelatorioImportacao } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  const organizationId = profile?.organization_id as string | undefined;
  if (!organizationId) {
    return { error: "Sem organização vinculada ao seu usuário" };
  }

  const admin = createAdminClient();

  // Importacao deixa proximo_contato_em=null. Pra prospeccao, o lead so
  // entra na fila quando o operador clicar "Disparar agora".

  // Pega leads existentes da org pra dedup
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
    origem: ComoOrigem;
    origem_inicial: ComoOrigem;
    caio_ativo: boolean;
    followup_ativo: boolean;
    dados_extras: Record<string, string>;
    proximo_contato_em: string | null;
  };
  const aInserir: NovoLead[] = [];
  const aReativar: { id: string }[] = [];
  const telefonesDoLote = new Set<string>();

  const statusNovo = como === "prospeccao" ? "aguardando_primeiro_contato" : "novo_lead";

  for (let i = 0; i < leads.length; i++) {
    const l = leads[i];
    const linha = i + 2;

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
        aReativar.push({ id: existente.id });
        continue;
      }
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
      status: statusNovo,
      origem: como,
      origem_inicial: como,
      caio_ativo: true,
      followup_ativo: true,
      dados_extras: l.dados_extras ?? {},
      proximo_contato_em: null,
    });
  }

  if (aInserir.length > 0) {
    const { error: insertErr } = await admin.from("leads").insert(aInserir);
    if (insertErr) {
      return { error: `Erro inserindo leads: ${insertErr.message}` };
    }
    relatorio.importados = aInserir.length;
  }

  // Reativa leads em status terminal pro modo escolhido. Mantem
  // chatwoot_conversation_id existente.
  for (const r of aReativar) {
    const { error: upErr } = await admin
      .from("leads")
      .update({
        origem: como,
        status: statusNovo,
        caio_ativo: true,
        followup_ativo: true,
        numero_followup: 0,
        numero_reativacao: 0,
        numero_prospeccao: 0,
        proximo_followup_em: null,
        proximo_contato_em: null,
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

  revalidatePath("/dashboard/contatos");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/prospeccao");
  return { ok: true, relatorio };
}

/**
 * Cria 1 lead avulso via form manual.
 */
export async function criarContatoAvulso(
  lead: LeadImport,
  como: ComoOrigem,
): Promise<{ ok: true } | { error: string }> {
  const result = await importarContatosLote([lead], como);
  if ("error" in result) return result;
  if (result.relatorio.invalidos > 0) {
    return { error: result.relatorio.erros[0]?.motivo ?? "lead inválido" };
  }
  if (result.relatorio.pulados > 0) {
    return {
      error:
        result.relatorio.erros[0]?.motivo ?? "telefone já existe na base",
    };
  }
  return { ok: true };
}
