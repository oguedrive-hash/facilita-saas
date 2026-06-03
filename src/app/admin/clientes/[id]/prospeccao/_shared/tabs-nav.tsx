"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "cadencia", label: "Cadência" },
  { slug: "followup", label: "Follow-up" },
  { slug: "janela", label: "Janela de envio" },
  { slug: "importar", label: "Importar leads" },
] as const;

export function ProspeccaoTabsNav({ clienteId }: { clienteId: string }) {
  const pathname = usePathname();
  const base = `/admin/clientes/${clienteId}/prospeccao`;

  return (
    <div className="border-b border-cinza-claro mb-6">
      <nav className="flex gap-1 overflow-x-auto -mb-px">
        {TABS.map((t) => {
          const href = `${base}/${t.slug}`;
          const ativo = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={t.slug}
              href={href}
              className={`px-4 py-2.5 text-sm font-heading font-semibold whitespace-nowrap border-b-2 transition ${
                ativo
                  ? "border-laranja text-preto"
                  : "border-transparent text-cinza-medio hover:text-preto hover:border-cinza-claro"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
