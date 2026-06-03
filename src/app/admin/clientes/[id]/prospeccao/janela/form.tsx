"use client";

import { useState, useTransition } from "react";
import { salvarProspeccaoConfig, type ProspeccaoJanela } from "../actions";

const DIAS = [
  { num: 1, label: "Seg" },
  { num: 2, label: "Ter" },
  { num: 3, label: "Qua" },
  { num: 4, label: "Qui" },
  { num: 5, label: "Sex" },
  { num: 6, label: "Sáb" },
  { num: 0, label: "Dom" },
] as const;

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

  function toggleDia(dia: number) {
    setJanela((j) => {
      const dias = j.dias_semana.includes(dia)
        ? j.dias_semana.filter((d) => d !== dia)
        : [...j.dias_semana, dia].sort();
      return { ...j, dias_semana: dias };
    });
  }

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
            Janela de envio
          </h3>
          <p className="text-xs text-cinza-medio mt-1">
            Quando o Caio pode disparar mensagens de prospecção. Fora desses
            horários/dias, mensagens ficam em fila e disparam na próxima janela.
          </p>
        </div>

        <div className="space-y-5 p-4 rounded-lg bg-offwhite border border-cinza-claro">
          <div>
            <label className="block text-xs font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-2">
              Dias da semana
            </label>
            <div className="flex gap-2 flex-wrap">
              {DIAS.map((d) => {
                const ativo = janela.dias_semana.includes(d.num);
                return (
                  <button
                    key={d.num}
                    type="button"
                    onClick={() => toggleDia(d.num)}
                    className={`px-3 py-2 rounded-lg text-xs font-heading font-semibold transition ${
                      ativo
                        ? "bg-preto text-white"
                        : "bg-white border border-cinza-claro text-cinza-medio hover:border-laranja hover:text-preto"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1.5">
                Hora início
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={janela.hora_inicio}
                  onChange={(e) =>
                    setJanela({
                      ...janela,
                      hora_inicio: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-24 px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:border-laranja transition"
                />
                <span className="text-sm text-cinza-medio">h</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1.5">
                Hora fim
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={janela.hora_fim}
                  onChange={(e) =>
                    setJanela({
                      ...janela,
                      hora_fim: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-24 px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:border-laranja transition"
                />
                <span className="text-sm text-cinza-medio">h</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1.5">
              Limite de envios por hora
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100}
                value={janela.rate_limit_hora}
                onChange={(e) =>
                  setJanela({
                    ...janela,
                    rate_limit_hora: parseInt(e.target.value, 10) || 1,
                  })
                }
                className="w-24 px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:border-laranja transition"
              />
              <span className="text-sm text-cinza-medio">msgs/h</span>
            </div>
            <p className="text-[10px] text-cinza-medio mt-1">
              Conservador: 10/h. Volumes maiores aumentam risco de ban do
              WhatsApp.
            </p>
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
          {pending ? "Salvando..." : "Salvar janela"}
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
