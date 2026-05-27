"use client";

import { useState, useTransition } from "react";
import { retranscreverAudio } from "@/app/dashboard/leads/[id]/actions";

export function BotaoRetranscrever({
  mensagemId,
  temConteudo,
}: {
  mensagemId: string;
  temConteudo: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function onClick() {
    setErro(null);
    const form = new FormData();
    form.set("mensagemId", mensagemId);
    startTransition(async () => {
      const result = await retranscreverAudio(form);
      if ("error" in result) {
        setErro(result.error);
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-start mt-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-[10px] text-cinza-medio hover:text-laranja font-heading font-semibold underline transition disabled:opacity-50"
      >
        {pending
          ? "Transcrevendo..."
          : temConteudo
            ? "Re-transcrever"
            : "Transcrever agora"}
      </button>
      {erro && <span className="text-[10px] text-red-600 mt-0.5">{erro}</span>}
    </div>
  );
}
