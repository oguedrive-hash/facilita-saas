import Link from "next/link";

export function EmptyState({
  titulo,
  descricao,
  icone,
  acao,
}: {
  titulo: string;
  descricao: string;
  icone?: string;
  acao?: { label: string; href: string };
}) {
  return (
    <div className="bg-white rounded-2xl border border-cinza-claro p-12 text-center">
      {icone && <div className="text-5xl mb-4">{icone}</div>}
      <h3 className="text-xl font-heading font-semibold text-preto mb-2">
        {titulo}
      </h3>
      <p className="text-sm text-cinza-medio mb-6 max-w-md mx-auto">
        {descricao}
      </p>
      {acao && (
        <Link
          href={acao.href}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-laranja hover:bg-laranja-escuro text-white font-heading font-semibold text-sm transition"
        >
          {acao.label}
        </Link>
      )}
    </div>
  );
}
