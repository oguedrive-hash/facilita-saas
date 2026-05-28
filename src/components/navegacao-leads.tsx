"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Botões anterior/próximo lead + atalhos teclado.
 * Setas esquerda/direita navegam (ignora se foco tá em input/textarea).
 */
export function NavegacaoLeads({
  anteriorId,
  proximoId,
  posicao,
  total,
}: {
  anteriorId: string | null;
  proximoId: string | null;
  posicao: number;
  total: number;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignora se usuário tá digitando em input/textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft" && anteriorId) {
        e.preventDefault();
        router.push(`/dashboard/leads/${anteriorId}`);
      } else if (e.key === "ArrowRight" && proximoId) {
        e.preventDefault();
        router.push(`/dashboard/leads/${proximoId}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anteriorId, proximoId, router]);

  return (
    <div className="flex items-center gap-2">
      <NavButton
        href={anteriorId ? `/dashboard/leads/${anteriorId}` : null}
        label="← Anterior"
        title="Lead anterior (←)"
      />
      <span className="text-xs text-cinza-medio font-mono">
        {posicao} / {total}
      </span>
      <NavButton
        href={proximoId ? `/dashboard/leads/${proximoId}` : null}
        label="Próximo →"
        title="Próximo lead (→)"
      />
    </div>
  );
}

function NavButton({
  href,
  label,
  title,
}: {
  href: string | null;
  label: string;
  title: string;
}) {
  if (!href) {
    return (
      <span className="px-3 py-1.5 text-xs text-cinza-medio rounded-lg bg-offwhite border border-cinza-claro opacity-50">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      title={title}
      className="px-3 py-1.5 text-xs text-preto rounded-lg bg-white border border-cinza-claro hover:border-laranja hover:text-laranja transition font-heading font-semibold"
    >
      {label}
    </Link>
  );
}
