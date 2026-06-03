/**
 * Config de intervalo da prospeccao ativa.
 *
 * Pra evitar ban do WhatsApp ao disparar a primeira mensagem em lote,
 * espacamos os disparos por X minutos. Cada lead na fila recebe a primeira
 * msg com `intervalo_minutos` de delay em relacao ao anterior.
 *
 * Antes essa config tinha dias da semana + hora_inicio + hora_fim + rate_limit,
 * mas isso era complicado demais — agora e so o intervalo entre disparos da
 * primeira regra.
 */

export type JanelaProspeccao = {
  intervalo_minutos: number;
};

const DEFAULT_JANELA: JanelaProspeccao = {
  intervalo_minutos: 2,
};

export function getJanela(raw: unknown): JanelaProspeccao {
  if (!raw || typeof raw !== "object") return DEFAULT_JANELA;
  const obj = raw as Record<string, unknown>;
  // Aceita o campo novo ou faz fallback pro default. Campos antigos
  // (dias_semana, hora_inicio, hora_fim, rate_limit_hora) sao ignorados.
  return {
    intervalo_minutos:
      typeof obj.intervalo_minutos === "number" && obj.intervalo_minutos > 0
        ? obj.intervalo_minutos
        : DEFAULT_JANELA.intervalo_minutos,
  };
}
