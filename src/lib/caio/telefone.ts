/**
 * Helpers de normalizacao de telefone.
 *
 * Telefones podem entrar com varios formatos:
 *   "+5519998744971", "55 19 99874-4971", "(19) 99874-4971", "19998744971"
 *
 * Pra comparacao consistente (dedup, lookup), reduzimos sempre a apenas os
 * digitos, ignorando + e qualquer formatacao.
 */

export function digitosTelefone(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/**
 * Normaliza pra E.164 brasileiro sem `+`: "5519998744971".
 *
 * Aceita 10-13 digitos. Se ja comeca com 55, mantem. Senao preenche com 55.
 * Devolve null se invalido.
 */
export function normalizarTelefoneBr(raw: string): string | null {
  const digits = digitosTelefone(raw);
  if (digits.length < 10 || digits.length > 13) return null;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  if (digits.startsWith("55")) return digits;
  return null;
}
