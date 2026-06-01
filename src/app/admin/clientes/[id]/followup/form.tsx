"use client";

import { useState, useTransition } from "react";
import {
  salvarFollowupConfig,
  type FollowupConfig,
  type FollowupRegra,
  type FollowupReativacao,
  type LembreteReuniaoConfig,
  type LembreteReuniaoRegra,
  type RetomadaConfig,
} from "./actions";

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

const DEFAULT_REATIVACAO: FollowupReativacao = {
  ativa: false,
  esperar_dias: 30,
  mensagem: "",
  usa_ia: true,
};

const DEFAULT_LEMBRETE: LembreteReuniaoRegra = {
  nivel: 1,
  quando: "antes",
  tempo_dias: 0,
  tempo_horas: 1,
  tempo_minutos: 0,
  mensagem: "",
  usa_ia: false,
  ativo: true,
};

export function FollowupEditor({
  organizationId,
  configInicial,
  mudarStatusAPartirInicial,
  lembreteConfigInicial,
  retomadaInicial,
}: {
  organizationId: string;
  configInicial: FollowupConfig | null;
  mudarStatusAPartirInicial: number;
  lembreteConfigInicial: LembreteReuniaoConfig | null;
  retomadaInicial: RetomadaConfig;
}) {
  const [regras, setRegras] = useState<FollowupRegra[]>(
    configInicial?.regras ?? [],
  );
  const [reativacao, setReativacao] = useState<FollowupReativacao>(
    configInicial?.reativacao ?? DEFAULT_REATIVACAO,
  );
  const [mudarStatusAPartir, setMudarStatusAPartir] = useState(
    mudarStatusAPartirInicial,
  );
  const [lembretes, setLembretes] = useState<LembreteReuniaoRegra[]>(
    lembreteConfigInicial?.regras ?? [],
  );
  const [retomada, setRetomada] = useState<RetomadaConfig>(retomadaInicial);
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

  function adicionarLembrete() {
    setLembretes((l) => [...l, { ...DEFAULT_LEMBRETE, nivel: l.length + 1 }]);
  }
  function removerLembrete(idx: number) {
    setLembretes((l) => l.filter((_, i) => i !== idx));
  }
  function atualizarLembrete(idx: number, patch: Partial<LembreteReuniaoRegra>) {
    setLembretes((l) =>
      l.map((reg, i) => (i === idx ? { ...reg, ...patch } : reg)),
    );
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const result = await salvarFollowupConfig(
        organizationId,
        { regras, reativacao },
        mudarStatusAPartir,
        { regras: lembretes },
        retomada,
      );
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

        {regras.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-laranja/5 border border-laranja/20">
            <label className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-preto">
                Mudar status do lead pra "follow-up" a partir da regra
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
                (antes disso, status fica como "em conversa" ou "novo lead")
              </span>
            </label>
          </div>
        )}

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

      {/* Seção 3: Lembretes de reunião agendada */}
      <section className="pt-6 border-t border-cinza-claro">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-heading font-bold text-preto">
              Lembretes de reunião agendada
            </h3>
            <p className="text-xs text-cinza-medio mt-1">
              Quando um lead tem reunião agendada, dispara lembretes antes ou
              depois da data marcada. Cada regra tem timestamp próprio
              relativo ao agendamento.
            </p>
          </div>
          <button
            type="button"
            onClick={adicionarLembrete}
            className="px-3 py-2 rounded-lg bg-laranja hover:bg-laranja-escuro text-white font-heading font-semibold text-sm transition"
          >
            + Adicionar lembrete
          </button>
        </div>

        {lembretes.length === 0 ? (
          <p className="text-sm text-cinza-medio text-center py-8 bg-offwhite rounded-lg border border-cinza-claro">
            Nenhum lembrete. Reuniões agendadas não vão ter aviso automático.
          </p>
        ) : (
          <div className="space-y-4">
            {lembretes.map((reg, idx) => (
              <LembreteCard
                key={idx}
                regra={reg}
                idx={idx}
                onChange={(patch) => atualizarLembrete(idx, patch)}
                onRemove={() => removerLembrete(idx)}
              />
            ))}
          </div>
        )}

        <p className="text-[10px] text-cinza-medio mt-3">
          Placeholders disponíveis: {"{nome}"}, {"{hora}"}, {"{data}"},{" "}
          {"{meet_link}"}
        </p>
      </section>

      {/* Seção 4: Mensagem de retomada (lead pediu pra chamar outro dia) */}
      <section className="pt-6 border-t border-cinza-claro">
        <div className="mb-3">
          <h3 className="text-base font-heading font-bold text-preto">
            Mensagem de retomada
          </h3>
          <p className="text-xs text-cinza-medio mt-1">
            Quando lead pede pra ser chamado em data específica ("me chama
            amanhã às 14h"), o Caio agenda automaticamente. Na hora combinada,
            dispara essa mensagem.
          </p>
        </div>
        <div className="space-y-3 p-4 rounded-lg bg-offwhite border border-cinza-claro">
          <div>
            <label className="block text-[10px] font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1">
              Mensagem
            </label>
            <textarea
              rows={2}
              value={retomada.mensagem}
              onChange={(e) =>
                setRetomada({ ...retomada, mensagem: e.target.value })
              }
              placeholder="Ex: Oi {nome}! Como combinamos, voltando ao contato. Posso te apresentar a Facilita?"
              className="w-full px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto placeholder:text-cinza-medio focus:outline-none focus:border-laranja transition text-sm"
            />
            <p className="text-[10px] text-cinza-medio mt-1">
              Use {"{nome}"} pra inserir o nome do lead.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={retomada.usa_ia}
              onChange={(e) =>
                setRetomada({ ...retomada, usa_ia: e.target.checked })
              }
              className="w-4 h-4 rounded text-laranja focus:ring-laranja"
            />
            <span className="text-sm text-preto">
              Personalizar com IA (Caio adapta ao histórico)
            </span>
            <span className="text-[10px] text-cinza-medio ml-2">
              Recomendado deixar desligado pra mensagem ficar previsível
            </span>
          </label>
        </div>
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
          Tipo de mensagem
        </label>
        <div className="flex gap-2 flex-wrap">
          {(["texto", "audio", "imagem", "video"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ tipo_midia: t })}
              className={`px-3 py-1.5 rounded-lg text-xs font-heading font-semibold transition ${
                (regra.tipo_midia ?? "texto") === t
                  ? "bg-preto text-white"
                  : "bg-white border border-cinza-claro text-cinza-medio hover:border-laranja hover:text-preto"
              }`}
            >
              {t === "texto" && "📝 Texto"}
              {t === "audio" && "🎙 Áudio"}
              {t === "imagem" && "🖼 Imagem"}
              {t === "video" && "🎥 Vídeo"}
            </button>
          ))}
        </div>
      </div>

      {(regra.tipo_midia === "imagem" || regra.tipo_midia === "video") && (
        <div className="mb-3">
          <UploadAnexo
            tipo={regra.tipo_midia}
            attachmentUrl={regra.attachment_url ?? null}
            attachmentMime={regra.attachment_mime ?? null}
            onUploaded={(url, mime) =>
              onChange({ attachment_url: url, attachment_mime: mime })
            }
            onRemove={() =>
              onChange({ attachment_url: null, attachment_mime: null })
            }
          />
        </div>
      )}

      <div className="mb-3">
        <label className="block text-[10px] font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1">
          {regra.tipo_midia === "audio"
            ? "Texto do áudio (vira voz via TTS)"
            : regra.tipo_midia === "imagem" || regra.tipo_midia === "video"
              ? "Legenda da mídia"
              : "Mensagem"}
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

function UploadAnexo({
  tipo,
  attachmentUrl,
  attachmentMime,
  onUploaded,
  onRemove,
}: {
  tipo: "imagem" | "video";
  attachmentUrl: string | null;
  attachmentMime: string | null;
  onUploaded: (url: string, mime: string) => void;
  onRemove: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    setEnviando(true);
    setStatusMsg(
      tipo === "video" && file.size > 14 * 1024 * 1024
        ? "Enviando e comprimindo vídeo (pode levar 1-2 min)…"
        : "Enviando…",
    );
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/followup/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "upload falhou");
        return;
      }
      if (data.comprimiu) {
        const mbOrig = (data.tamanho_original / 1024 / 1024).toFixed(1);
        const mbFinal = (data.tamanho_final / 1024 / 1024).toFixed(1);
        setStatusMsg(`✓ Comprimido de ${mbOrig}MB pra ${mbFinal}MB`);
        setTimeout(() => setStatusMsg(null), 5000);
      } else {
        setStatusMsg(null);
      }
      onUploaded(data.url, data.mime);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "erro");
    } finally {
      setEnviando(false);
    }
  }

  const accept = tipo === "imagem" ? "image/*" : "video/*";

  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-heading font-semibold text-cinza-medio uppercase tracking-wider">
        Arquivo {tipo === "imagem" ? "(imagem)" : "(vídeo)"}
      </label>
      {attachmentUrl ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-offwhite border border-cinza-claro">
          {tipo === "imagem" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attachmentUrl}
              alt="anexo"
              className="w-20 h-20 object-cover rounded-md border border-cinza-claro"
            />
          ) : (
            <video
              src={attachmentUrl}
              className="w-32 h-20 object-cover rounded-md border border-cinza-claro"
              controls={false}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-cinza-medio truncate">
              {attachmentMime ?? "?"}
            </p>
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-laranja hover:underline"
            >
              Abrir
            </a>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="px-2 py-1 text-xs text-cinza-medio hover:text-red-600 transition"
          >
            Remover
          </button>
        </div>
      ) : (
        <label className="block">
          <input
            type="file"
            accept={accept}
            onChange={handleUpload}
            disabled={enviando}
            className="block w-full text-xs text-cinza-medio file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-cinza-claro file:bg-white file:text-preto file:font-heading file:font-semibold file:text-xs hover:file:border-laranja cursor-pointer disabled:opacity-50"
          />
          {enviando && (
            <p className="text-[10px] text-cinza-medio mt-1">
              {statusMsg ?? "Enviando…"}
            </p>
          )}
          {!enviando && statusMsg && (
            <p className="text-[10px] text-emerald-700 mt-1">{statusMsg}</p>
          )}
          {erro && <p className="text-[10px] text-red-700 mt-1">{erro}</p>}
        </label>
      )}
    </div>
  );
}

function LembreteCard({
  regra,
  idx,
  onChange,
  onRemove,
}: {
  regra: LembreteReuniaoRegra;
  idx: number;
  onChange: (patch: Partial<LembreteReuniaoRegra>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-4 rounded-lg border border-cinza-claro bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-laranja text-white font-heading font-bold text-sm">
            {idx + 1}
          </span>
          <span className="text-sm font-heading font-semibold text-preto">
            Lembrete nº{idx + 1}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-cinza-medio hover:text-red-600 transition"
          title="Remover"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3 items-end">
        <div>
          <label className="block text-[10px] font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1">
            Quando
          </label>
          <select
            value={regra.quando}
            onChange={(e) =>
              onChange({ quando: e.target.value as "antes" | "depois" })
            }
            className="w-full px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:border-laranja transition text-sm"
          >
            <option value="antes">Antes da reunião</option>
            <option value="depois">Depois da reunião</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={30}
            value={regra.tempo_dias}
            onChange={(e) =>
              onChange({ tempo_dias: parseInt(e.target.value, 10) || 0 })
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
            value={regra.tempo_horas}
            onChange={(e) =>
              onChange({ tempo_horas: parseInt(e.target.value, 10) || 0 })
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
            value={regra.tempo_minutos}
            onChange={(e) =>
              onChange({ tempo_minutos: parseInt(e.target.value, 10) || 0 })
            }
            className="w-full px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:border-laranja transition text-sm"
          />
          <span className="text-xs text-cinza-medio">min</span>
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
          placeholder="Ex: Oi {nome}, sua reunião é {data} às {hora}. Link: {meet_link}"
          className="w-full px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto placeholder:text-cinza-medio focus:outline-none focus:border-laranja transition text-sm"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={regra.usa_ia}
            onChange={(e) => onChange({ usa_ia: e.target.checked })}
            className="w-4 h-4 rounded text-laranja focus:ring-laranja"
          />
          <span className="text-xs text-preto">Personalizar com IA</span>
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
