"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizarReativacao } from "./_shared/reativacao-helpers";

export type TipoMidia = "texto" | "audio" | "imagem" | "video";

export type FollowupRegra = {
  nivel: number;
  esperar_dias: number;
  esperar_horas: number;
  esperar_minutos: number;
  mensagem: string;
  usa_ia: boolean;
  ativo: boolean;
  tipo_midia: TipoMidia;
  attachment_url: string | null;
  attachment_mime: string | null;
};

export type ReativacaoRegra = {
  nivel: number;
  esperar_dias: number;
  esperar_horas: number;
  esperar_minutos: number;
  mensagem: string;
  usa_ia: boolean;
  ativo: boolean;
  tipo_midia: TipoMidia;
  attachment_url: string | null;
  attachment_mime: string | null;
};

export type FollowupReativacao = {
  ativa: boolean;
  regras: ReativacaoRegra[];
};

export type FollowupConfig = {
  regras: FollowupRegra[];
  reativacao: FollowupReativacao;
};

export type LembreteReuniaoRegra = {
  nivel: number;
  quando: "antes" | "depois";
  tempo_dias: number;
  tempo_horas: number;
  tempo_minutos: number;
  mensagem: string;
  usa_ia: boolean;
  ativo: boolean;
  tipo_midia: TipoMidia;
  attachment_url: string | null;
  attachment_mime: string | null;
};

export type LembreteReuniaoConfig = {
  regras: LembreteReuniaoRegra[];
};

export type RetomadaConfig = {
  mensagem: string;
  usa_ia: boolean;
  tipo_midia: TipoMidia;
  attachment_url: string | null;
  attachment_mime: string | null;
};

/**
 * Salva config de follow-up. Tudo opcional — cada sub-aba envia só o
 * pedaco que ela edita. Quando um param e undefined, preserva o valor
 * atual do banco.
 *
 * Lembretes "antes" e "depois" sao salvos em campos separados pra cada
 * sub-aba editar so o seu lado sem precisar carregar o outro.
 */
export async function salvarFollowupConfig(
  organizationId: string,
  patch: {
    regras?: FollowupRegra[];
    reativacao?: FollowupReativacao;
    mudarStatusAPartir?: number;
    lembretesAntes?: LembreteReuniaoRegra[];
    lembretesDepois?: LembreteReuniaoRegra[];
    retomada?: RetomadaConfig;
  },
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  // Valida admin
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
    return { error: "Apenas admin pode editar follow-up" };
  }

  // Le config atual do banco — pra preservar campos nao enviados
  const { data: orgAtual } = await supabase
    .from("organizations")
    .select(
      "followup_config, followup_mudar_status_a_partir, lembrete_reuniao_config, mensagem_retomada, mensagem_retomada_usa_ia, mensagem_retomada_tipo_midia, mensagem_retomada_attachment_url, mensagem_retomada_attachment_mime",
    )
    .eq("id", organizationId)
    .single();
  const configAtual = orgAtual?.followup_config as
    | { regras?: FollowupRegra[]; reativacao?: unknown }
    | null;
  const lembreteAtual = (orgAtual?.lembrete_reuniao_config as
    | LembreteReuniaoConfig
    | null)?.regras ?? [];

  // Se um campo do patch e undefined, usa o valor atual do banco
  const regrasInput = patch.regras ?? configAtual?.regras ?? [];
  const reativacaoInput: FollowupReativacao =
    patch.reativacao ?? normalizarReativacao(configAtual?.reativacao);
  const mudarStatusAPartirFinal =
    patch.mudarStatusAPartir ??
    orgAtual?.followup_mudar_status_a_partir ??
    1;
  // Lembretes: mescla antes + depois. Se o patch nao manda um dos lados,
  // preserva o que ja estava no banco pra esse lado.
  const lembretesAntesInput =
    patch.lembretesAntes ?? lembreteAtual.filter((r) => r.quando !== "depois");
  const lembretesDepoisInput =
    patch.lembretesDepois ??
    lembreteAtual.filter((r) => r.quando === "depois");
  const retomadaInput: RetomadaConfig = patch.retomada ?? {
    mensagem: orgAtual?.mensagem_retomada ?? "",
    usa_ia: !!orgAtual?.mensagem_retomada_usa_ia,
    tipo_midia: (orgAtual?.mensagem_retomada_tipo_midia ?? "texto") as TipoMidia,
    attachment_url: orgAtual?.mensagem_retomada_attachment_url ?? null,
    attachment_mime: orgAtual?.mensagem_retomada_attachment_mime ?? null,
  };

  // Sanitiza: clamp valores, re-numera níveis sequencialmente
  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));
  const tiposValidos: TipoMidia[] = ["texto", "audio", "imagem", "video"];

  // Helper: regra de cadencia ou reativacao tem a mesma forma — sanitiza igual
  function sanitizarRegraEspera<
    T extends {
      esperar_dias?: number;
      esperar_horas?: number;
      esperar_minutos?: number;
      mensagem?: string;
      usa_ia?: boolean;
      ativo?: boolean;
      tipo_midia?: TipoMidia;
      attachment_url?: string | null;
      attachment_mime?: string | null;
    },
  >(r: T, nivel: number) {
    const tipoMidia: TipoMidia = tiposValidos.includes(r.tipo_midia as TipoMidia)
      ? (r.tipo_midia as TipoMidia)
      : "texto";
    const precisaAttachment =
      tipoMidia === "imagem" || tipoMidia === "video";
    return {
      nivel,
      esperar_dias: Math.round(clamp(r.esperar_dias ?? 0, 0, 365)),
      esperar_horas: Math.round(clamp(r.esperar_horas ?? 0, 0, 24)),
      esperar_minutos: Math.round(clamp(r.esperar_minutos ?? 0, 0, 59)),
      mensagem: (r.mensagem ?? "").trim(),
      usa_ia: !!r.usa_ia,
      ativo: r.ativo !== false,
      tipo_midia: tipoMidia,
      attachment_url: precisaAttachment ? (r.attachment_url ?? null) : null,
      attachment_mime: precisaAttachment ? (r.attachment_mime ?? null) : null,
    };
  }

  // Filtra regras vazias: precisa ter mensagem OU anexo (pra imagem/video).
  function eRegraValida(r: {
    mensagem?: string;
    tipo_midia?: TipoMidia;
    attachment_url?: string | null;
  }) {
    const temMsg = (r.mensagem?.trim().length ?? 0) > 0;
    const temAnexo =
      (r.tipo_midia === "imagem" || r.tipo_midia === "video") &&
      !!r.attachment_url;
    return temMsg || temAnexo;
  }

  const regrasLimpas = regrasInput
    .filter(eRegraValida)
    .map((r, i) => sanitizarRegraEspera(r, i + 1));

  const reativacaoRegrasLimpas: ReativacaoRegra[] = (reativacaoInput.regras ?? [])
    .filter(eRegraValida)
    .map((r, i) => sanitizarRegraEspera(r, i + 1));

  const reativacaoLimpa: FollowupReativacao = {
    ativa: !!reativacaoInput.ativa,
    regras: reativacaoRegrasLimpas,
  };

  const mudarSanitizado = Math.round(
    clamp(mudarStatusAPartirFinal ?? 1, 1, Math.max(1, regrasLimpas.length)),
  );

  // Sanitiza regras de lembrete de reuniao — renumera niveis (campo `quando` extra)
  const lembretesLimpos = [
    ...lembretesAntesInput.map((r) => ({ ...r, quando: "antes" as const })),
    ...lembretesDepoisInput.map((r) => ({ ...r, quando: "depois" as const })),
  ]
    .filter((r) => {
      const temMsg = (r.mensagem?.trim().length ?? 0) > 0;
      const temAnexo =
        (r.tipo_midia === "imagem" || r.tipo_midia === "video") &&
        !!r.attachment_url;
      return temMsg || temAnexo;
    })
    .map((r, i) => {
      const tipoMidia: TipoMidia = tiposValidos.includes(r.tipo_midia)
        ? r.tipo_midia
        : "texto";
      const precisaAttachment =
        tipoMidia === "imagem" || tipoMidia === "video";
      return {
        nivel: i + 1,
        quando: r.quando === "depois" ? ("depois" as const) : ("antes" as const),
        tempo_dias: Math.round(clamp(r.tempo_dias ?? 0, 0, 30)),
        tempo_horas: Math.round(clamp(r.tempo_horas ?? 0, 0, 24)),
        tempo_minutos: Math.round(clamp(r.tempo_minutos ?? 0, 0, 59)),
        mensagem: (r.mensagem ?? "").trim(),
        usa_ia: !!r.usa_ia,
        ativo: r.ativo !== false,
        tipo_midia: tipoMidia,
        attachment_url: precisaAttachment ? (r.attachment_url ?? null) : null,
        attachment_mime: precisaAttachment ? (r.attachment_mime ?? null) : null,
      };
    });

  const { error } = await supabase
    .from("organizations")
    .update({
      followup_config: { regras: regrasLimpas, reativacao: reativacaoLimpa },
      followup_mudar_status_a_partir: mudarSanitizado,
      lembrete_reuniao_config: { regras: lembretesLimpos },
      mensagem_retomada: (retomadaInput.mensagem ?? "").trim() || null,
      mensagem_retomada_usa_ia: !!retomadaInput.usa_ia,
      mensagem_retomada_tipo_midia: tiposValidos.includes(
        retomadaInput.tipo_midia,
      )
        ? retomadaInput.tipo_midia
        : "texto",
      mensagem_retomada_attachment_url:
        (retomadaInput.tipo_midia === "imagem" ||
          retomadaInput.tipo_midia === "video") &&
        retomadaInput.attachment_url
          ? retomadaInput.attachment_url
          : null,
      mensagem_retomada_attachment_mime:
        (retomadaInput.tipo_midia === "imagem" ||
          retomadaInput.tipo_midia === "video") &&
        retomadaInput.attachment_mime
          ? retomadaInput.attachment_mime
          : null,
    })
    .eq("id", organizationId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/clientes/${organizationId}/followup`, "layout");
  revalidatePath(`/admin/clientes/${organizationId}`);
  return { ok: true };
}
