/**
 * Badge visual de origem do contato (inbound vs prospecção).
 * Usado em listagens e na página de detalhe pra deixar claro qual fluxo o
 * contato está rodando.
 */
export function OrigemBadge({
  origem,
  size = "sm",
}: {
  origem: string | null;
  size?: "sm" | "md";
}) {
  const padding = size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  if (origem === "prospeccao") {
    return (
      <span
        className={`inline-flex items-center gap-1 ${padding} rounded-full font-heading font-semibold border bg-blue-50 text-blue-700 border-blue-300`}
      >
        🎯 Prospecção
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 ${padding} rounded-full font-heading font-semibold border bg-cinza-claro/40 text-cinza-medio border-cinza-claro`}
    >
      📥 Inbound
    </span>
  );
}
