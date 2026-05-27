type Mensagem = {
  id: string;
  conteudo: string | null;
  tipo: "texto" | "audio" | "imagem" | "video" | "arquivo";
  attachment_url: string | null;
  direcao: "entrada" | "saida";
  remetente_nome: string | null;
  created_at: string;
};

export function TimelineMensagens({ mensagens }: { mensagens: Mensagem[] }) {
  if (mensagens.length === 0) {
    return (
      <p className="text-sm text-cinza-medio text-center py-8">
        Nenhuma mensagem ainda. Quando o lead conversar, as mensagens aparecem
        aqui.
      </p>
    );
  }

  return (
    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
      {mensagens.map((m) => (
        <Balao key={m.id} mensagem={m} />
      ))}
    </div>
  );
}

function Balao({ mensagem }: { mensagem: Mensagem }) {
  const entrada = mensagem.direcao === "entrada";

  return (
    <div className={`flex ${entrada ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          entrada
            ? "bg-offwhite border border-cinza-claro text-preto"
            : "bg-laranja text-white"
        }`}
      >
        <ConteudoMensagem mensagem={mensagem} />
        <p
          className={`text-[10px] mt-1 ${
            entrada ? "text-cinza-medio" : "text-white/70"
          }`}
        >
          {new Date(mensagem.created_at).toLocaleString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function ConteudoMensagem({ mensagem }: { mensagem: Mensagem }) {
  if (mensagem.tipo === "audio") {
    return (
      <div>
        <p className="text-xs font-heading font-semibold mb-1">🎙️ Áudio</p>
        {mensagem.attachment_url && (
          <audio controls src={mensagem.attachment_url} className="max-w-full" />
        )}
        {mensagem.conteudo && (
          <p className="text-sm mt-1 italic opacity-80">
            &ldquo;{mensagem.conteudo}&rdquo;
          </p>
        )}
      </div>
    );
  }

  if (mensagem.tipo === "imagem" && mensagem.attachment_url) {
    return (
      <div>
        <picture>
          <img
            src={mensagem.attachment_url}
            alt="Imagem enviada pelo lead"
            className="max-w-full rounded-lg"
          />
        </picture>
        {mensagem.conteudo && (
          <p className="text-sm mt-2">{mensagem.conteudo}</p>
        )}
      </div>
    );
  }

  if (mensagem.tipo === "video" && mensagem.attachment_url) {
    return (
      <div>
        <video controls src={mensagem.attachment_url} className="max-w-full rounded-lg" />
        {mensagem.conteudo && (
          <p className="text-sm mt-2">{mensagem.conteudo}</p>
        )}
      </div>
    );
  }

  if (mensagem.tipo === "arquivo") {
    return (
      <div>
        <p className="text-xs font-heading font-semibold mb-1">📎 Arquivo</p>
        {mensagem.attachment_url && (
          <a
            href={mensagem.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline"
          >
            Abrir arquivo
          </a>
        )}
      </div>
    );
  }

  return (
    <p className="text-sm whitespace-pre-wrap break-words">
      {mensagem.conteudo ?? <em className="opacity-60">(sem conteúdo)</em>}
    </p>
  );
}
