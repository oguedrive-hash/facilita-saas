/**
 * Helpers de janela de envio pra prospeccao.
 */

export type Janela = {
  dias_semana: number[];
  hora_inicio: number;
  hora_fim: number;
  rate_limit_hora: number;
};

const DEFAULT_JANELA: Janela = {
  dias_semana: [1, 2, 3, 4, 5],
  hora_inicio: 9,
  hora_fim: 18,
  rate_limit_hora: 10,
};

export function getJanela(raw: unknown): Janela {
  if (!raw || typeof raw !== "object") return DEFAULT_JANELA;
  const obj = raw as Record<string, unknown>;
  return {
    dias_semana: Array.isArray(obj.dias_semana)
      ? (obj.dias_semana as number[])
      : DEFAULT_JANELA.dias_semana,
    hora_inicio:
      typeof obj.hora_inicio === "number"
        ? obj.hora_inicio
        : DEFAULT_JANELA.hora_inicio,
    hora_fim:
      typeof obj.hora_fim === "number" ? obj.hora_fim : DEFAULT_JANELA.hora_fim,
    rate_limit_hora:
      typeof obj.rate_limit_hora === "number"
        ? obj.rate_limit_hora
        : DEFAULT_JANELA.rate_limit_hora,
  };
}

/**
 * Devolve true se o instante `quando` esta dentro da janela configurada.
 * Comparacao em horario local do servidor (BRT no caso da Facilita).
 */
export function dentroDaJanela(quando: Date, janela: Janela): boolean {
  const dia = quando.getDay();
  const hora = quando.getHours();
  return (
    janela.dias_semana.includes(dia) &&
    hora >= janela.hora_inicio &&
    hora < janela.hora_fim
  );
}

/**
 * Dado um instante `desejado` e a janela, devolve quando o envio pode
 * realmente acontecer:
 *  - se `desejado` ja esta na janela, devolve `desejado`
 *  - senao, salta pra proxima ocorrencia de `hora_inicio` num dia valido
 */
export function proximoSlot(desejado: Date, janela: Janela): Date {
  if (janela.dias_semana.length === 0) {
    // janela sem dias = nunca envia; devolve longe no futuro
    const longe = new Date(desejado);
    longe.setFullYear(longe.getFullYear() + 10);
    return longe;
  }
  const cursor = new Date(desejado);
  for (let tentativas = 0; tentativas < 14; tentativas++) {
    const dia = cursor.getDay();
    if (janela.dias_semana.includes(dia)) {
      const hora = cursor.getHours();
      if (hora < janela.hora_inicio) {
        cursor.setHours(janela.hora_inicio, 0, 0, 0);
        return cursor;
      }
      if (hora < janela.hora_fim) {
        // Dentro da janela — devolve o instante exato pra agendamentos
        // precisos (sem zerar segundos, que causava delay de 1 min).
        return cursor;
      }
      // hora >= hora_fim → avanca pro proximo dia
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(janela.hora_inicio, 0, 0, 0);
  }
  // Fallback: nao deveria acontecer com qualquer config valida
  return cursor;
}
