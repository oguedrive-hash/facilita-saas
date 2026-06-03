"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TipoMidia = "texto" | "audio" | "imagem" | "video";

export type ProspeccaoRegra = {
  nivel: number;
  esperar_dias: number;
  esperar_horas: number;
  esperar_minutos: number;
  mensagem: string;
  ativo: boolean;
  tipo_midia: TipoMidia;
  attachment_url: string | null;
  attachment_mime: string | null;
};

export type ProspeccaoConfig = {
  regras: ProspeccaoRegra[];
};

// Cadencia de follow-up especifica pra leads de prospeccao que ja responderam
// uma vez e depois sumiram. Mesmas regras estruturalmente; o que muda e o
// tom/conteudo das mensagens.
export type ProspeccaoFollowupConfig = {
  regras: ProspeccaoRegra[];
};

export type ProspeccaoJanela = {
  dias_semana: number[]; // 0=domingo ... 6=sabado
  hora_inicio: number; // 0-23
  hora_fim: number; // 0-23
  rate_limit_hora: number; // msgs por hora por org
};

const JANELA_DEFAULT: ProspeccaoJanela = {
  dias_semana: [1, 2, 3, 4, 5],
  hora_inicio: 9,
  hora_fim: 18,
  rate_limit_hora: 10,
};

/**
 * Salva config de prospeccao. Cada sub-aba envia so seu pedaco
 * (regras OU janela). Action mescla com o que ja esta no banco.
 */
export async function salvarProspeccaoConfig(
  organizationId: string,
  patch: {
    regras?: ProspeccaoRegra[];
    janela?: ProspeccaoJanela;
    followup?: ProspeccaoRegra[];
  },
): Promise<{ ok: true } | { error: string }> {
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
    return { error: "Apenas admin pode editar prospecção" };
  }

  const { data: orgAtual } = await supabase
    .from("organizations")
    .select("prospeccao_config, prospeccao_janela, prospeccao_followup_config")
    .eq("id", organizationId)
    .single();

  const configAtual = orgAtual?.prospeccao_config as ProspeccaoConfig | null;
  const janelaAtual = (orgAtual?.prospeccao_janela as ProspeccaoJanela | null) ??
    JANELA_DEFAULT;
  const followupAtual = orgAtual?.prospeccao_followup_config as
    | ProspeccaoFollowupConfig
    | null;

  const regrasInput = patch.regras ?? configAtual?.regras ?? [];
  const janelaInput = patch.janela ?? janelaAtual;
  const followupInput = patch.followup ?? followupAtual?.regras ?? [];

  // Sanitiza regras
  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));
  const tiposValidos: TipoMidia[] = ["texto", "audio", "imagem", "video"];

  function sanitizarRegras(regras: ProspeccaoRegra[]): ProspeccaoRegra[] {
    return regras
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
          esperar_dias: Math.round(clamp(r.esperar_dias ?? 0, 0, 365)),
          esperar_horas: Math.round(clamp(r.esperar_horas ?? 0, 0, 24)),
          esperar_minutos: Math.round(clamp(r.esperar_minutos ?? 0, 0, 59)),
          mensagem: (r.mensagem ?? "").trim(),
          ativo: r.ativo !== false,
          tipo_midia: tipoMidia,
          attachment_url: precisaAttachment ? (r.attachment_url ?? null) : null,
          attachment_mime: precisaAttachment
            ? (r.attachment_mime ?? null)
            : null,
        };
      });
  }
  const regrasLimpas = sanitizarRegras(regrasInput);
  const followupLimpo = sanitizarRegras(followupInput);

  // Sanitiza janela
  const diasSemanaLimpos = Array.from(
    new Set(
      (janelaInput.dias_semana ?? [])
        .map((d) => Math.round(clamp(d, 0, 6)))
        .filter((d) => Number.isInteger(d)),
    ),
  ).sort();
  const horaInicio = Math.round(clamp(janelaInput.hora_inicio ?? 9, 0, 23));
  let horaFim = Math.round(clamp(janelaInput.hora_fim ?? 18, 0, 23));
  if (horaFim <= horaInicio) horaFim = horaInicio + 1;
  const rateLimitHora = Math.round(
    clamp(janelaInput.rate_limit_hora ?? 10, 1, 100),
  );
  const janelaLimpa: ProspeccaoJanela = {
    dias_semana: diasSemanaLimpos.length > 0 ? diasSemanaLimpos : [1, 2, 3, 4, 5],
    hora_inicio: horaInicio,
    hora_fim: horaFim,
    rate_limit_hora: rateLimitHora,
  };

  const { error } = await supabase
    .from("organizations")
    .update({
      prospeccao_config: { regras: regrasLimpas },
      prospeccao_janela: janelaLimpa,
      prospeccao_followup_config: { regras: followupLimpo },
    })
    .eq("id", organizationId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/clientes/${organizationId}/prospeccao`, "layout");
  return { ok: true };
}
