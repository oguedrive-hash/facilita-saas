import type {
  FollowupReativacao,
  ReativacaoRegra,
  TipoMidia,
} from "../actions";

/**
 * Converte qualquer shape legado de reativacao no novo formato.
 *
 * Shape antigo: { ativa, esperar_dias, mensagem, usa_ia, tipo_midia, attachment_url, attachment_mime }
 * Shape novo:   { ativa, regras: [{ nivel, esperar_dias, esperar_horas, ... }] }
 */
export function normalizarReativacao(raw: unknown): FollowupReativacao {
  if (!raw || typeof raw !== "object") {
    return { ativa: false, regras: [] };
  }
  const obj = raw as Record<string, unknown>;
  // Shape novo
  if (Array.isArray(obj.regras)) {
    return {
      ativa: !!obj.ativa,
      regras: obj.regras as ReativacaoRegra[],
    };
  }
  // Shape antigo: converte pra uma unica regra
  if (typeof obj.mensagem === "string" || typeof obj.esperar_dias === "number") {
    return {
      ativa: !!obj.ativa,
      regras: [
        {
          nivel: 1,
          esperar_dias: Number(obj.esperar_dias ?? 30),
          esperar_horas: 0,
          esperar_minutos: 0,
          mensagem: String(obj.mensagem ?? ""),
          usa_ia: !!obj.usa_ia,
          ativo: true,
          tipo_midia: (obj.tipo_midia as TipoMidia) ?? "texto",
          attachment_url: (obj.attachment_url as string | null) ?? null,
          attachment_mime: (obj.attachment_mime as string | null) ?? null,
        },
      ],
    };
  }
  return { ativa: !!obj.ativa, regras: [] };
}
