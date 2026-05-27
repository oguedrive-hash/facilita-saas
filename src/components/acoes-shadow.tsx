"use client";

import { useState, useTransition } from "react";
import {
  aprovarShadow,
  descartarShadow,
} from "@/app/dashboard/leads/[id]/actions";

export function AcoesShadow({ mensagemId }: { mensagemId: string }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function onAprovar() {
    setErro(null);
    const form = new FormData();
    form.set("mensagemId", mensagemId);
    startTransition(async () => {
      const result = await aprovarShadow(form);
      if ("error" in result) setErro(result.error);
    });
  }

  function onDescartar() {
    setErro(null);
    const form = new FormData();
    form.set("mensagemId", mensagemId);
    startTransition(async () => {
      const result = await descartarShadow(form);
      if ("error" in result) setErro(result.error);
    });
  }

  return (
    <div className="mt-2 pt-2 border-t border-cinza-claro">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDescartar}
          disabled={pending}
          className="text-[10px] text-cinza-medio hover:text-red-600 font-heading font-semibold transition disabled:opacity-50"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={onAprovar}
          disabled={pending}
          className="px-3 py-1 bg-laranja text-white text-[10px] font-heading font-semibold rounded-full hover:bg-laranja/90 transition disabled:opacity-50"
        >
          {pending ? "..." : "Aprovar e enviar"}
        </button>
      </div>
      {erro && (
        <p className="text-[10px] text-red-600 text-right mt-1">{erro}</p>
      )}
    </div>
  );
}
