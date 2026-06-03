"use client";

import { useState, useTransition } from "react";
import {
  salvarFollowupConfig,
  type FollowupRegra,
} from "../actions";
import { RegraCard } from "../_shared/regra-card";

const DEFAULT_REGRA: FollowupRegra = {
  nivel: 1,
  esperar_dias: 1,
  esperar_horas: 0,
  esperar_minutos: 0,
  mensagem: "",
  usa_ia: false,
  ativo: true,
  tipo_midia: "texto",
  attachment_url: null,
  attachment_mime: null,
};

export function CadenciaForm({
  organizationId,
  regrasIniciais,
  mudarStatusAPartirInicial,
}: {
  organizationId: string;
  regrasIniciais: FollowupRegra[];
  mudarStatusAPartirInicial: number;
}) {
  const [regras, setRegras] = useState<FollowupRegra[]>(regrasIniciais);
  const [mudarStatusAPartir, setMudarStatusAPartir] = useState(
    mudarStatusAPartirInicial,
  );
  const [pending, startTransition] = useTransition();
  const [salvouAgora, setSalvouAgora] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function adicionarRegra() {
    setRegras((r) => [...r, { ...DEFAULT_REGRA, nivel: r.length + 1 }]);
  }
  function removerRegra(idx: number) {
    setRegras((r) => r.filter((_, i) => i !== idx));
  }
  function moverRegra(idx: number, delta: -1 | 1) {
    setRegras((r) => {
      const novo = [...r];
      const target = idx + delta;
      if (target < 0 || target >= novo.length) return r;
      [novo[idx], novo[target]] = [novo[target], novo[idx]];
      return novo;
    });
  }
  function atualizarRegra(idx: number, patch: Partial<FollowupRegra>) {
    setRegras((r) => r.map((reg, i) => (i === idx ? { ...reg, ...patch } : reg)));
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const result = await salvarFollowupConfig(organizationId, {
        regras,
        mudarStatusAPartir,
      });
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-heading font-bold text-preto">
              Regras de follow-up
            </h3>
            <p className="text-xs text-cinza-medio mt-1">
              Cada regra dispara X tempo depois da anterior (ou da última msg
              do lead, se for a primeira). Lead que responder zera o ciclo.
            </p>
          </div>
          <button
            type="button"
            onClick={adicionarRegra}
            className="px-3 py-2 rounded-lg bg-laranja hover:bg-laranja-escuro text-white font-heading font-semibold text-sm transition"
          >
            + Adicionar regra
          </button>
        </div>

        {regras.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-laranja/5 border border-laranja/20">
            <label className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-preto">
                Mudar status do lead pra &quot;follow-up&quot; a partir da regra
              </span>
              <input
                type="number"
                min={1}
                max={regras.length}
                value={mudarStatusAPartir}
                onChange={(e) =>
                  setMudarStatusAPartir(parseInt(e.target.value, 10) || 1)
                }
                className="w-16 px-2 py-1 rounded-md border border-cinza-claro bg-white text-preto text-sm focus:outline-none focus:border-laranja"
              />
              <span className="text-xs text-cinza-medio">
                (antes disso, status fica como &quot;em conversa&quot; ou
                &quot;novo lead&quot;)
              </span>
            </label>
          </div>
        )}

        {regras.length === 0 ? (
          <p className="text-sm text-cinza-medio text-center py-8 bg-offwhite rounded-lg border border-cinza-claro">
            Nenhuma regra. Lead que parar de responder vira &quot;perdido&quot;
            imediatamente.
          </p>
        ) : (
          <div className="space-y-4">
            {regras.map((regra, idx) => (
              <RegraCard
                key={idx}
                regra={regra}
                idx={idx}
                ehPrimeira={idx === 0}
                ehUltima={idx === regras.length - 1}
                total={regras.length}
                onChange={(patch) => atualizarRegra(idx, patch)}
                onRemove={() => removerRegra(idx)}
                onMoverCima={() => moverRegra(idx, -1)}
                onMoverBaixo={() => moverRegra(idx, 1)}
              />
            ))}
          </div>
        )}
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
          {pending ? "Salvando..." : "Salvar cadência"}
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
