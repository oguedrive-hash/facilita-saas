"use client";

import { useState } from "react";

type TipoMidia = "texto" | "audio" | "imagem" | "video";

const ROTULOS: Record<TipoMidia, string> = {
  texto: "📝 Texto",
  audio: "🎙 Áudio",
  imagem: "🖼 Imagem",
  video: "🎥 Vídeo",
};

export function MidiaPicker({
  tipoMidia,
  attachmentUrl,
  attachmentMime,
  onChangeTipo,
  onAttachmentChange,
}: {
  tipoMidia: TipoMidia;
  attachmentUrl: string | null;
  attachmentMime: string | null;
  onChangeTipo: (t: TipoMidia) => void;
  onAttachmentChange: (url: string | null, mime: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1">
          Tipo de mensagem
        </label>
        <div className="flex gap-2 flex-wrap">
          {(["texto", "audio", "imagem", "video"] as TipoMidia[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChangeTipo(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-heading font-semibold transition ${
                tipoMidia === t
                  ? "bg-preto text-white"
                  : "bg-white border border-cinza-claro text-cinza-medio hover:border-laranja hover:text-preto"
              }`}
            >
              {ROTULOS[t]}
            </button>
          ))}
        </div>
      </div>
      {(tipoMidia === "imagem" || tipoMidia === "video") && (
        <UploadAnexo
          tipo={tipoMidia}
          attachmentUrl={attachmentUrl}
          attachmentMime={attachmentMime}
          onUploaded={onAttachmentChange}
          onRemove={() => onAttachmentChange(null, null)}
        />
      )}
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
