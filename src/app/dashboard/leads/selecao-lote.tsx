"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { moverLeadsParaProspeccao } from "./mover-prospeccao-actions";

type SelecaoCtx = {
  selecionados: Set<string>;
  toggle: (id: string) => void;
  marcarTodos: (ids: string[]) => void;
  desmarcarTodos: () => void;
};

const Ctx = createContext<SelecaoCtx | null>(null);

export function SelecaoLoteProvider({ children }: { children: ReactNode }) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const ctx: SelecaoCtx = useMemo(
    () => ({
      selecionados,
      toggle: (id) =>
        setSelecionados((s) => {
          const novo = new Set(s);
          if (novo.has(id)) novo.delete(id);
          else novo.add(id);
          return novo;
        }),
      marcarTodos: (ids) => setSelecionados(new Set(ids)),
      desmarcarTodos: () => setSelecionados(new Set()),
    }),
    [selecionados],
  );

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}

function useSelecao(): SelecaoCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("Sem SelecaoLoteProvider acima");
  return c;
}

export function CheckboxLeadLote({ leadId }: { leadId: string }) {
  const { selecionados, toggle } = useSelecao();
  return (
    <input
      type="checkbox"
      checked={selecionados.has(leadId)}
      onChange={() => toggle(leadId)}
      onClick={(e) => e.stopPropagation()}
      className="w-4 h-4 rounded text-laranja focus:ring-laranja cursor-pointer"
      aria-label="Selecionar lead"
    />
  );
}

export function CheckboxTodosLote({ ids }: { ids: string[] }) {
  const { selecionados, marcarTodos, desmarcarTodos } = useSelecao();
  const todos = ids.length > 0 && selecionados.size === ids.length;
  const alguns = selecionados.size > 0 && selecionados.size < ids.length;
  return (
    <input
      type="checkbox"
      checked={todos}
      ref={(el) => {
        if (el) el.indeterminate = alguns;
      }}
      onChange={() => (todos ? desmarcarTodos() : marcarTodos(ids))}
      className="w-4 h-4 rounded text-laranja focus:ring-laranja cursor-pointer"
      aria-label="Selecionar todos"
    />
  );
}

export function ToolbarLoteLeads() {
  const router = useRouter();
  const { selecionados, desmarcarTodos } = useSelecao();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    movidos: number;
    pulados: number;
  } | null>(null);

  if (selecionados.size === 0 && !resultado && !erro) return null;

  function mover() {
    setErro(null);
    setResultado(null);
    const ids = Array.from(selecionados);
    startTransition(async () => {
      const r = await moverLeadsParaProspeccao(ids);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setResultado({
        movidos: r.relatorio.movidos,
        pulados: r.relatorio.pulados.length,
      });
      desmarcarTodos();
      router.refresh();
    });
  }

  return (
    <div className="sticky top-[72px] z-10 mb-3 p-3 rounded-lg bg-laranja/5 border border-laranja/20 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 text-sm">
        {selecionados.size > 0 && (
          <>
            <span className="text-preto">
              <strong>{selecionados.size}</strong> lead
              {selecionados.size > 1 ? "s" : ""} selecionado
              {selecionados.size > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={desmarcarTodos}
              className="text-xs text-cinza-medio hover:text-preto underline"
            >
              limpar
            </button>
          </>
        )}
        {resultado && (
          <span className="text-xs text-emerald-700">
            ✓ {resultado.movidos} movido
            {resultado.movidos !== 1 ? "s" : ""}
            {resultado.pulados > 0 &&
              ` · ${resultado.pulados} pulado${resultado.pulados !== 1 ? "s" : ""}`}
          </span>
        )}
        {erro && <span className="text-xs text-red-700">{erro}</span>}
      </div>
      {selecionados.size > 0 && (
        <button
          type="button"
          onClick={mover}
          disabled={pending}
          className="px-4 py-2 rounded-lg bg-laranja hover:bg-laranja-escuro disabled:bg-laranja/40 text-white font-heading font-semibold text-sm transition"
        >
          {pending ? "Movendo..." : "🎯 Enviar pra prospecção"}
        </button>
      )}
    </div>
  );
}
