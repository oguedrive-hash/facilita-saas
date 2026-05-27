"use client";

import { useState, useTransition } from "react";
import { responderLead } from "@/app/dashboard/leads/[id]/actions";

export function CaixaResposta({
  leadId,
  podeResponder,
}: {
  leadId: string;
  podeResponder: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [conteudo, setConteudo] = useState("");

  if (!podeResponder) {
    return (
      <div className="border-t border-cinza-claro pt-4 mt-4">
        <p className="text-xs text-cinza-medio text-center">
          Sem conversa do Chatwoot vinculada — não dá pra responder este lead.
        </p>
      </div>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = new FormData(e.currentTarget);
    form.set("leadId", leadId);

    startTransition(async () => {
      const result = await responderLead(form);
      if ("error" in result) {
        setErro(result.error);
        return;
      }
      setConteudo("");
    });
  }

  return (
    <form onSubmit={onSubmit} className="border-t border-cinza-claro pt-4 mt-4">
      <label className="block text-xs font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-2">
        Responder como Caio (humano assume — Caio para de responder)
      </label>
      <textarea
        name="conteudo"
        value={conteudo}
        onChange={(e) => setConteudo(e.target.value)}
        rows={3}
        placeholder="Digite uma resposta..."
        disabled={pending}
        className="w-full px-3 py-2 border border-cinza-claro rounded-lg text-sm text-preto placeholder:text-cinza-medio focus:outline-none focus:border-laranja transition disabled:opacity-50"
      />

      {erro && (
        <p className="text-xs text-red-600 mt-2">{erro}</p>
      )}

      <div className="flex items-center justify-end gap-3 mt-3">
        <span className="text-xs text-cinza-medio">
          {pending ? "Enviando..." : "Vai aplicar etiqueta `agente-off`"}
        </span>
        <button
          type="submit"
          disabled={pending || !conteudo.trim()}
          className="px-4 py-2 bg-laranja text-white text-sm font-heading font-semibold rounded-lg hover:bg-laranja/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Enviando..." : "Enviar"}
        </button>
      </div>
    </form>
  );
}
