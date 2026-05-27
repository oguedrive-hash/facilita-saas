/**
 * Logo da Facilita Plus — versão texto + acento "plus"
 * Baseado no manual da marca (assinatura horizontal principal).
 *
 * Quando o sócio mandar o SVG do ícone "F", substituímos por uma versão com ícone.
 */
export function Logo({
  className = "",
  showPlus = true,
}: {
  className?: string;
  showPlus?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-baseline font-heading font-bold text-2xl tracking-tight text-preto ${className}`}
    >
      facilita
      {showPlus && (
        <span className="ml-1 px-1.5 py-0.5 bg-laranja text-white text-[0.55em] font-semibold rounded leading-none relative -top-2">
          plus
        </span>
      )}
    </span>
  );
}
