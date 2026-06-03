"use client";

import { useState, useTransition } from "react";
import { salvarProspeccaoConfig, type ProspeccaoJanela } from "../actions";

export function JanelaForm({
  organizationId,
  janelaInicial,
}: {
  organizationId: string;
  janelaInicial: ProspeccaoJanela;
}) {
  const [janela, setJanela] = useState<ProspeccaoJanela>(janelaInicial);
  const [pending, startTransition] = useTransition();
  const [salvouAgora, setSalvouAgora] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const result = await salvarProspeccaoConfig(organizationId, { janela });
      if ("error" in result) {
        setErro(result.error);
      } else {
        setSalvouAgora(true);
        setTimeout(() => setSalvouAgora(false), 3000);
      }
    });
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-4">
          <h3 className="text-base font-heading font-bold text-preto">
            Intervalo entre disparos
          </h3>
          <p className="text-xs text-cinza-medio mt-1">
            Quando você seleciona vários contatos e clica &quot;Disparar
            agora&quot;, o sistema espaça os envios da primeira mensagem desse
            tempo entre cada lead — evita o WhatsApp marcar como spam.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-offwhite border border-cinza-claro">
          <label className="block text-xs font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1.5">
            Intervalo entre cada contato (minutos)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={120}
              value={janela.intervalo_minutos}
              onChange={(e) =>
                setJanela({
                  ...janela,
                  intervalo_minutos: parseInt(e.target.value, 10) || 1,
                })
              }
              className="w-24 px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:border-laranja transition"
            />
            <span className="text-sm text-cinza-medio">min</span>
          </div>
          <p className="text-[10px] text-cinza-medio mt-2">
            Conservador: 2 a 5 min. Volumes maiores ou intervalos menores
            aumentam risco de ban do WhatsApp.
          </p>

          <div className="mt-4 p-3 rounded-md bg-white border border-cinza-claro">
            <p className="text-[10px] font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1">
              Exemplo
            </p>
            <p className="text-xs text-preto">
              10 contatos selecionados, intervalo de {janela.intervalo_minutos}{" "}
              min:
            </p>
            <ul className="text-[11px] text-cinza-medio mt-1 space-y-0.5">
              <li>• Contato 1 → dispara imediato</li>
              <li>• Contato 2 → em {janela.intervalo_minutos} min</li>
              <li>• Contato 3 → em {janela.intervalo_minutos * 2} min</li>
              <li>• ...</li>
              <li>
                • Contato 10 → em {janela.intervalo_minutos * 9} min
              </li>
            </ul>
          </div>
        </div>
      </section>

      {erro && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-800">{erro}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-cinza-claro">
        <button
          type="button"
          onClick={salvar}
          disabled={pending}
          className="px-5 py-3 rounded-lg bg-laranja hover:bg-laranja-escuro disabled:bg-laranja-claro text-white font-heading font-semibold transition"
        >
          {pending ? "Salvando..." : "Salvar intervalo"}
        </button>
        {salvouAgora && (
          <span className="text-sm text-green-700 font-heading font-semibold">
            ✓ Salvo
          </span>
        )}
      </div>
    </div>
  );
}
