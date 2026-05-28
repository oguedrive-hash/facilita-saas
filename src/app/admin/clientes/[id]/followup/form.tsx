"use client";

import { useState, useTransition } from "react";
import {
  salvarFollowupConfig,
  type FollowupConfig,
  type FollowupRegra,
  type FollowupReativacao,
} from "./actions";

const DEFAULT_REGRA: FollowupRegra = {
  nivel: 1,
  esperar_dias: 1,
  esperar_horas: 0,
  esperar_minutos: 0,
  mensagem: "",
  usa_ia: false,
  ativo: true,
};

const DEFAULT_REATIVACAO: FollowupReativacao = {
  ativa: false,
  esperar_dias: 30,
  mensagem: "",
  usa_ia: true,
};

export function FollowupEditor({
  organizationId,
  configInicial,
}: {
  organizationId: string;
  configInicial: FollowupConfig | null;
}) {
  const [regras, setRegras] = useState<FollowupRegra[]>(
    configInicial?.regras ?? [],
  );
  const [reativacao, setReativacao] = useState<FollowupReativacao>(
    configInicial?.reativacao ?? DEFAULT_REATIVACAO,
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
        reativacao,
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
    <div className="space-y-8">
      {/* Seção 1: Regras de follow-up */}
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

        {regras.length === 0 ? (
          <p className="text-sm text-cinza-medio text-center py-8 bg-offwhite rounded-lg border border-cinza-claro">
            Nenhuma regra. Lead que parar de responder vira "perdido"
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

      {/* Seção 2: Reativação */}
      <section className="pt-6 border-t border-cinza-claro">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-heading font-bold text-preto">
              Reativação de leads perdidos
            </h3>
            <p className="text-xs text-cinza-medio mt-1">
              Quando o Caio desistir (após todas as regras), tentar uma última
              mensagem depois de X dias.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={reativacao.ativa}
              onChange={(e) =>
                setReativacao({ ...reativacao, ativa: e.target.checked })
              }
              className="w-4 h-4 rounded text-laranja focus:ring-laranja"
            />
            <span className="text-sm font-heading font-semibold text-preto">
              Ativar
            </span>
          </label>
        </div>

        {reativacao.ativa && (
          <div className="space-y-4 p-4 rounded-lg bg-offwhite border border-cinza-claro">
            <div>
              <label className="block text-xs font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1.5">
                Esperar quantos dias após desistir
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={reativacao.esperar_dias}
                onChange={(e) =>
                  setReativacao({
                    ...reativacao,
                    esperar_dias: parseInt(e.target.value, 10) || 30,
                  })
                }
                className="w-32 px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:border-laranja transition"
              />
            </div>
            <div>
              <label className="block text-xs font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1.5">
                Mensagem de reativação
              </label>
              <textarea
                rows={3}
                value={reativacao.mensagem}
                onChange={(e) =>
                  setReativacao({ ...reativacao, mensagem: e.target.value })
                }
                placeholder="Ex: Oi {nome}, ainda buscando soluções na sua área? Posso te atualizar com novidades."
                className="w-full px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto placeholder:text-cinza-medio focus:outline-none focus:border-laranja transition text-sm"
              />
              <p className="text-[10px] text-cinza-medio mt-1">
                Use {"{nome}"} pra inserir o nome do lead.
              </p>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={reativacao.usa_ia}
                onChange={(e) =>
                  setReativacao({ ...reativacao, usa_ia: e.target.checked })
                }
                className="w-4 h-4 rounded text-laranja focus:ring-laranja"
              />
              <span className="text-sm text-preto">
                Personalizar com IA (Caio adapta a mensagem ao histórico)
              </span>
            </label>
          </div>
        )}
      </section>

      {/* Footer */}
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
          {pending ? "Salvando..." : "Salvar configuração"}
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

function RegraCard({
  regra,
  idx,
  ehPrimeira,
  ehUltima,
  total,
  onChange,
  onRemove,
  onMoverCima,
  onMoverBaixo,
}: {
  regra: FollowupRegra;
  idx: number;
  ehPrimeira: boolean;
  ehUltima: boolean;
  total: number;
  onChange: (patch: Partial<FollowupRegra>) => void;
  onRemove: () => void;
  onMoverCima: () => void;
  onMoverBaixo: () => void;
}) {
  const referencia = ehPrimeira
    ? "última mensagem do lead"
    : `follow-up nº${idx} ser enviado`;

  return (
    <div className="p-4 rounded-lg border border-cinza-claro bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-laranja text-white font-heading font-bold text-sm">
            {idx + 1}
          </span>
          <span className="text-sm font-heading font-semibold text-preto">
            Follow-up nº{idx + 1} de {total}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoverCima}
            disabled={ehPrimeira}
            className="p-1.5 text-cinza-medio hover:text-preto disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Mover pra cima"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoverBaixo}
            disabled={ehUltima}
            className="p-1.5 text-cinza-medio hover:text-preto disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Mover pra baixo"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-cinza-medio hover:text-red-600 transition"
            title="Remover regra"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-[10px] font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1">
          Esperar após {referencia}
        </label>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={365}
              value={regra.esperar_dias}
              onChange={(e) =>
                onChange({ esperar_dias: parseInt(e.target.value, 10) || 0 })
              }
              className="w-full px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:border-laranja transition text-sm"
            />
            <span className="text-xs text-cinza-medio">dias</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={23}
              value={regra.esperar_horas}
              onChange={(e) =>
                onChange({ esperar_horas: parseInt(e.target.value, 10) || 0 })
              }
              className="w-full px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:border-laranja transition text-sm"
            />
            <span className="text-xs text-cinza-medio">h</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={59}
              value={regra.esperar_minutos}
              onChange={(e) =>
                onChange({ esperar_minutos: parseInt(e.target.value, 10) || 0 })
              }
              className="w-full px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:border-laranja transition text-sm"
            />
            <span className="text-xs text-cinza-medio">min</span>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-[10px] font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1">
          Mensagem
        </label>
        <textarea
          rows={2}
          value={regra.mensagem}
          onChange={(e) => onChange({ mensagem: e.target.value })}
          placeholder="Ex: Oi {nome}, ainda por aí?"
          className="w-full px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto placeholder:text-cinza-medio focus:outline-none focus:border-laranja transition text-sm"
        />
        <p className="text-[10px] text-cinza-medio mt-1">
          Use {"{nome}"} pra inserir o nome do lead.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={regra.usa_ia}
            onChange={(e) => onChange({ usa_ia: e.target.checked })}
            className="w-4 h-4 rounded text-laranja focus:ring-laranja"
          />
          <span className="text-xs text-preto">
            Personalizar com IA (Caio adapta ao histórico do lead)
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={regra.ativo}
            onChange={(e) => onChange({ ativo: e.target.checked })}
            className="w-4 h-4 rounded text-laranja focus:ring-laranja"
          />
          <span className="text-xs text-preto">Ativa</span>
        </label>
      </div>
    </div>
  );
}
