"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Periodo = "todos" | "hoje" | "7d" | "30d";

type Props = {
  periodo: Periodo;
  de: string;
  ate: string;
  hiddenInputs: { name: string; value: string }[];
  presets: Record<Periodo, string>;
  hrefLimpar: string;
};

const PRESET_LABELS: Record<Periodo, string> = {
  todos: "Todo o período",
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
};

const BOTAO_LABELS: Record<Periodo, string> = {
  todos: "Todo o período",
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
};

export function PeriodoDropdown({
  periodo,
  de,
  ate,
  hiddenInputs,
  presets,
  hrefLimpar,
}: Props) {
  const [aberto, setAberto] = useState(false);
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

  const label =
    de || ate ? `${de || "..."} → ${ate || "..."}` : BOTAO_LABELS[periodo];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg bg-preto text-white hover:opacity-90 font-heading font-semibold text-sm transition"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 text-white/80"
        >
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span className="whitespace-nowrap">{label}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-3 h-3 text-white/80 transition-transform ${
            aberto ? "rotate-180" : ""
          }`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div className="absolute right-0 top-full mt-1 z-20 w-72 bg-white border border-cinza-claro rounded-lg shadow-lg p-2">
          <div className="flex flex-col gap-0.5">
            {(Object.keys(PRESET_LABELS) as Periodo[]).map((p) => {
              const ativo = periodo === p && !de && !ate;
              return (
                <Link
                  key={p}
                  href={presets[p]}
                  onClick={() => setAberto(false)}
                  className={`px-3 py-2 rounded-md text-sm font-heading transition ${
                    ativo
                      ? "bg-preto text-white font-semibold"
                      : "text-preto hover:bg-offwhite"
                  }`}
                >
                  {PRESET_LABELS[p]}
                </Link>
              );
            })}
          </div>

          <div className="my-2 border-t border-cinza-claro" />

          <form
            method="get"
            action="/dashboard/leads"
            className="flex flex-col gap-2 p-2"
          >
            {hiddenInputs.map((i) => (
              <input
                key={i.name}
                type="hidden"
                name={i.name}
                value={i.value}
              />
            ))}
            <label className="text-[10px] font-heading font-semibold text-cinza-medio uppercase tracking-wider">
              Personalizado
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                name="de"
                defaultValue={de}
                className="flex-1 px-2 py-1.5 text-xs border border-cinza-claro rounded-md bg-white text-preto focus:outline-none focus:border-laranja transition"
              />
              <span className="text-xs text-cinza-medio">→</span>
              <input
                type="date"
                name="ate"
                defaultValue={ate}
                className="flex-1 px-2 py-1.5 text-xs border border-cinza-claro rounded-md bg-white text-preto focus:outline-none focus:border-laranja transition"
              />
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <button
                type="submit"
                className="flex-1 px-3 py-1.5 text-xs font-heading font-semibold bg-preto text-white rounded-md hover:opacity-90 transition"
              >
                Aplicar
              </button>
              {(de || ate) && (
                <Link
                  href={hrefLimpar}
                  onClick={() => setAberto(false)}
                  className="px-3 py-1.5 text-xs text-cinza-medio hover:text-preto transition"
                >
                  Limpar
                </Link>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
