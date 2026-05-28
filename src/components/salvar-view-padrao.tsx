"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setViewPreferida } from "@/app/dashboard/leads/preferencias-actions";

type View = "lista" | "kanban";

export function SalvarViewPadrao({
  viewSalva,
}: {
  viewAtual: View;
  viewSalva: View | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    if (aberto) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [aberto]);

  function fixarComo(view: View) {
    startTransition(async () => {
      await setViewPreferida(view);
      setAberto(false);
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="p-2 rounded-lg text-cinza-medio hover:text-preto hover:bg-offwhite transition"
        title="Opções de visualização"
        aria-label="Opções de visualização"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-4 h-4"
        >
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {aberto && (
        <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-white border border-cinza-claro rounded-lg shadow-lg py-1">
          <p className="px-3 py-1.5 text-[10px] font-heading font-semibold text-cinza-medio uppercase tracking-wider">
            Visualização padrão
          </p>
          <OpcaoMenu
            label="Lista"
            ativo={viewSalva === "lista"}
            disabled={pending}
            onClick={() => fixarComo("lista")}
          />
          <OpcaoMenu
            label="Kanban"
            ativo={viewSalva === "kanban"}
            disabled={pending}
            onClick={() => fixarComo("kanban")}
          />
        </div>
      )}
    </div>
  );
}

function OpcaoMenu({
  label,
  ativo,
  disabled,
  onClick,
}: {
  label: string;
  ativo: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-between px-3 py-2 text-sm text-preto hover:bg-offwhite transition disabled:opacity-50"
    >
      <span>Fixar {label} como padrão</span>
      {ativo && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 text-laranja"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}
