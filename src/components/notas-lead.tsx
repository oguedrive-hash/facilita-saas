"use client";

import { useState, useTransition } from "react";
import { salvarNotas } from "@/app/dashboard/leads/[id]/actions";

export function NotasLead({
  leadId,
  notasIniciais,
}: {
  leadId: string;
  notasIniciais: string | null;
}) {
  const [editando, setEditando] = useState(false);
  const [notas, setNotas] = useState(notasIniciais ?? "");
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function onSalvar() {
    setErro(null);
    const form = new FormData();
    form.set("leadId", leadId);
    form.set("notas", notas);
    startTransition(async () => {
      const result = await salvarNotas(form);
      if ("error" in result) {
        setErro(result.error);
        return;
      }
      setEditando(false);
    });
  }

  if (!editando) {
    return (
      <div>
        {notasIniciais ? (
          <p className="text-sm text-preto whitespace-pre-wrap mb-2">
            {notasIniciais}
          </p>
        ) : (
          <p className="text-xs text-cinza-medio italic mb-2">
            Sem notas. Clica em &ldquo;Editar&rdquo; pra adicionar.
          </p>
        )}
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="text-xs text-laranja hover:text-laranja-escuro font-heading font-semibold transition"
        >
          {notasIniciais ? "Editar" : "+ Adicionar nota"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <textarea
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={4}
        placeholder="Observações sobre esse lead..."
        disabled={pending}
        autoFocus
        className="w-full px-3 py-2 border border-cinza-claro rounded-lg text-sm text-preto placeholder:text-cinza-medio focus:outline-none focus:border-laranja transition disabled:opacity-50"
      />
      {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
      <div className="flex items-center justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={() => {
            setEditando(false);
            setNotas(notasIniciais ?? "");
          }}
          disabled={pending}
          className="text-xs text-cinza-medio hover:text-preto transition disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSalvar}
          disabled={pending}
          className="px-3 py-1.5 bg-laranja text-white text-xs font-heading font-semibold rounded-lg hover:bg-laranja/90 transition disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
