"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FollowupRegra = {
  nivel: number;
  esperar_dias: number;
  esperar_horas: number;
  esperar_minutos: number;
  mensagem: string;
  usa_ia: boolean;
  ativo: boolean;
};

export type FollowupReativacao = {
  ativa: boolean;
  esperar_dias: number;
  mensagem: string;
  usa_ia: boolean;
};

export type FollowupConfig = {
  regras: FollowupRegra[];
  reativacao: FollowupReativacao;
};

export async function salvarFollowupConfig(
  organizationId: string,
  config: FollowupConfig,
  mudarStatusAPartir: number,
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

  // Sanitiza: clamp valores, re-numera níveis sequencialmente
  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));
  const regrasLimpas = config.regras
    .filter((r) => r.mensagem?.trim().length > 0)
    .map((r, i) => ({
      nivel: i + 1,
      esperar_dias: Math.round(clamp(r.esperar_dias ?? 0, 0, 365)),
      esperar_horas: Math.round(clamp(r.esperar_horas ?? 0, 0, 24)),
      esperar_minutos: Math.round(clamp(r.esperar_minutos ?? 0, 0, 59)),
      mensagem: r.mensagem.trim(),
      usa_ia: !!r.usa_ia,
      ativo: r.ativo !== false,
    }));

  const reativacaoLimpa: FollowupReativacao = {
    ativa: !!config.reativacao?.ativa,
    esperar_dias: Math.round(
      clamp(config.reativacao?.esperar_dias ?? 30, 1, 365),
    ),
    mensagem: (config.reativacao?.mensagem ?? "").trim(),
    usa_ia: !!config.reativacao?.usa_ia,
  };

  const mudarSanitizado = Math.round(
    clamp(mudarStatusAPartir ?? 1, 1, Math.max(1, regrasLimpas.length)),
  );

  const { error } = await supabase
    .from("organizations")
    .update({
      followup_config: { regras: regrasLimpas, reativacao: reativacaoLimpa },
      followup_mudar_status_a_partir: mudarSanitizado,
    })
    .eq("id", organizationId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/clientes/${organizationId}/followup`);
  revalidatePath(`/admin/clientes/${organizationId}`);
  return { ok: true };
}
